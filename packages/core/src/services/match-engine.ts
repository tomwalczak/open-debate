import { streamText } from "./llm.js";
import { getModel } from "./model-provider.js";
import { createJudgeAgent } from "./agent-factory.js";
import { judgeTopic, calculateFinalTally, generateMatchSummary, generateIssueArgumentSummary } from "./judge-service.js";
import type { MatchSummary, IssueArgumentSummary } from "../types/judge.js";
import { updateAgentAfterDebate } from "./agent-learner.js";
import { createMatch, saveDebateResult, logMatchEvent, logMatchError, loadMatchForResume, saveMatchSummary, saveIssueArgumentSummary, type CreateMatchResult } from "./match-storage.js";
import { generateTopics } from "./topic-generator.js";
import { generateId } from "../utils/id.js";
import { processHumanInput } from "./response-expander.js";
import type { AgentConfig } from "../types/agent.js";
import type { LLMRole } from "../types/config.js";
import type {
  MatchConfig,
  MatchState,
  DebateConfig,
  Exchange,
  TopicResult,
  TopicExecutionState,
} from "../types/debate.js";

/**
 * Get the model ID for a specific role from config.
 * Falls back to config.modelId if no per-role config exists.
 */
function getModelForRole(config: MatchConfig, role: LLMRole): string {
  return config.models?.[role] ?? config.modelId;
}

const MAX_CONCURRENT_TOPICS = 5;

/**
 * Generate issue argument summaries in parallel and deliver via callback.
 * Does not block - fires callbacks as each issue completes.
 * Also saves each issue argument to disk.
 */
function generateIssueArgumentsInBackground(
  summary: MatchSummary,
  speaker1Name: string,
  speaker2Name: string,
  debates: import("../types/debate.js").DebateResult[],
  modelId: string,
  dirPath: string,
  onIssueArgumentReady: (issueArg: IssueArgumentSummary) => void
): void {
  for (const issue of summary.issues) {
    generateIssueArgumentSummary(
      issue,
      speaker1Name,
      speaker2Name,
      debates,
      modelId
    ).then((issueArg) => {
      // Save to disk
      saveIssueArgumentSummary(dirPath, issueArg);
      // Notify callback
      onIssueArgumentReady(issueArg);
    }).catch((err) => {
      logMatchError(dirPath, err, `Failed to generate argument summary for issue: ${issue}`);
    });
  }
}

export interface HumanInputContext {
  topicIndex: number;
  topic: string;
  exchanges: Exchange[];
  currentSpeakerId: string;
  turnNumber: number;
  totalTurns: number;
  speakerName: string;
  speakerPersona: string;
  opponentLastMessage?: string;
}

export interface MatchCallbacks {
  onMatchStart: (match: MatchState) => void;
  onDebateStart: (debateNumber: number) => void;
  onDebateEnd: (debateNumber: number, speaker1Wins: number, speaker2Wins: number) => void;
  onMatchEnd: (match: MatchState) => void;
  onMatchSummary: (summary: MatchSummary) => void;
  onIssueArgumentReady?: (issueArg: IssueArgumentSummary) => void;
  onTopicStateChange: (topicState: TopicExecutionState) => void;
  onTopicStreamChunk: (topicIndex: number, chunk: string) => void;
  onLearning: () => void;
  onError: (error: Error) => void;
  onHumanInputRequired?: (context: HumanInputContext) => Promise<string>;
  onWaitForHumanContinue?: (context: HumanContinueContext) => Promise<void>;
}

export interface HumanContinueContext {
  topicIndex: number;
  topic: string;
  turnNumber: number;
  totalTurns: number;
  opponentName: string;
  opponentMessage: string;
  isLastTurn: boolean;
}

class TopicPool {
  private running = 0;
  private queue: Array<() => Promise<void>> = [];
  private maxConcurrent: number;

  constructor(maxConcurrent: number = MAX_CONCURRENT_TOPICS) {
    this.maxConcurrent = maxConcurrent;
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        this.running++;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.processNext();
        }
      };

      if (this.running < this.maxConcurrent) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }

  private processNext() {
    if (this.queue.length > 0 && this.running < this.maxConcurrent) {
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

async function generateSpeakerResponse(
  speaker: AgentConfig,
  topic: string,
  previousExchanges: Exchange[],
  turnNumber: number,
  onChunk: (chunk: string) => void
): Promise<string> {
  const messages = previousExchanges.map((ex) => ({
    role: ex.speakerId === speaker.id ? ("assistant" as const) : ("user" as const),
    content: ex.message,
  }));

  const systemPrompt = `${speaker.systemPrompt}

Current debate topic: ${topic}
You are on turn ${turnNumber} of this debate.

Be concise. Keep your response under 300 words.`;

  let fullMessage = "";

  const result = await streamText({
    model: getModel(speaker.modelId),
    system: systemPrompt,
    messages:
      messages.length > 0
        ? messages
        : [{ role: "user" as const, content: `Please argue your position on: ${topic}` }],
  });

  for await (const chunk of result.textStream) {
    fullMessage += chunk;
    onChunk(chunk);
  }

  return fullMessage;
}

async function executeTopic(
  topicIndex: number,
  topic: string,
  turnsPerTopic: number,
  firstSpeaker: AgentConfig,
  secondSpeaker: AgentConfig,
  judge: AgentConfig,
  callbacks: MatchCallbacks,
  config: MatchConfig,
  humanSpeakerId?: string,
  humanSpeakerPersona?: string
): Promise<TopicResult> {
  const exchanges: Exchange[] = [];

  let topicState: TopicExecutionState = {
    topicIndex,
    topic,
    status: "debating",
    currentTurn: 1,
    currentSpeakerId: null,
    exchanges: [],
    streamingText: "",
    verdict: null,
  };

  callbacks.onTopicStateChange(topicState);

  for (let turn = 1; turn <= turnsPerTopic; turn++) {
    topicState = { ...topicState, currentTurn: turn };

    // First speaker's turn
    topicState = {
      ...topicState,
      currentSpeakerId: firstSpeaker.id,
      streamingText: "",
    };
    callbacks.onTopicStateChange(topicState);

    let speaker1Message: string;
    if (humanSpeakerId && firstSpeaker.id === humanSpeakerId && callbacks.onHumanInputRequired) {
      // Human's turn - request input
      const lastOpponentMessage = exchanges.length > 0 ? exchanges[exchanges.length - 1].message : undefined;
      const humanInput = await callbacks.onHumanInputRequired({
        topicIndex,
        topic,
        exchanges: [...exchanges],
        currentSpeakerId: firstSpeaker.id,
        turnNumber: turn,
        totalTurns: turnsPerTopic,
        speakerName: firstSpeaker.name,
        speakerPersona: humanSpeakerPersona || firstSpeaker.name,
        opponentLastMessage: lastOpponentMessage,
      });
      // Process/expand human input
      speaker1Message = await processHumanInput(
        humanInput,
        firstSpeaker.name,
        topic,
        exchanges,
        turn,
        getModelForRole(config, "coach") // Use coach model for human input expansion
      );
    } else {
      // AI's turn
      speaker1Message = await generateSpeakerResponse(
        firstSpeaker,
        topic,
        exchanges,
        turn,
        (chunk) => {
          topicState = {
            ...topicState,
            streamingText: topicState.streamingText + chunk,
          };
          callbacks.onTopicStreamChunk(topicIndex, chunk);
          callbacks.onTopicStateChange(topicState);
        }
      );
    }

    const exchange1: Exchange = {
      id: generateId(),
      speakerId: firstSpeaker.id,
      speakerName: firstSpeaker.name,
      message: speaker1Message,
      turnNumber: turn,
      topicIndex,
    };
    exchanges.push(exchange1);

    topicState = {
      ...topicState,
      exchanges: [...exchanges],
      streamingText: "",
    };
    callbacks.onTopicStateChange(topicState);

    // If human is second speaker, wait for them to read opponent's response before their turn
    if (humanSpeakerId && secondSpeaker.id === humanSpeakerId && callbacks.onWaitForHumanContinue) {
      await callbacks.onWaitForHumanContinue({
        topicIndex,
        topic,
        turnNumber: turn,
        totalTurns: turnsPerTopic,
        opponentName: firstSpeaker.name,
        opponentMessage: speaker1Message,
        isLastTurn: false,
      });
    }

    // Second speaker's turn
    topicState = {
      ...topicState,
      currentSpeakerId: secondSpeaker.id,
      streamingText: "",
    };
    callbacks.onTopicStateChange(topicState);

    let speaker2Message: string;
    if (humanSpeakerId && secondSpeaker.id === humanSpeakerId && callbacks.onHumanInputRequired) {
      // Human's turn - request input
      const lastOpponentMessage = exchanges.length > 0 ? exchanges[exchanges.length - 1].message : undefined;
      const humanInput = await callbacks.onHumanInputRequired({
        topicIndex,
        topic,
        exchanges: [...exchanges],
        currentSpeakerId: secondSpeaker.id,
        turnNumber: turn,
        totalTurns: turnsPerTopic,
        speakerName: secondSpeaker.name,
        speakerPersona: humanSpeakerPersona || secondSpeaker.name,
        opponentLastMessage: lastOpponentMessage,
      });
      // Process/expand human input
      speaker2Message = await processHumanInput(
        humanInput,
        secondSpeaker.name,
        topic,
        exchanges,
        turn,
        getModelForRole(config, "coach") // Use coach model for human input expansion
      );
    } else {
      // AI's turn
      speaker2Message = await generateSpeakerResponse(
        secondSpeaker,
        topic,
        exchanges,
        turn,
        (chunk) => {
          topicState = {
            ...topicState,
            streamingText: topicState.streamingText + chunk,
          };
          callbacks.onTopicStreamChunk(topicIndex, chunk);
          callbacks.onTopicStateChange(topicState);
        }
      );
    }

    const exchange2: Exchange = {
      id: generateId(),
      speakerId: secondSpeaker.id,
      speakerName: secondSpeaker.name,
      message: speaker2Message,
      turnNumber: turn,
      topicIndex,
    };
    exchanges.push(exchange2);

    topicState = {
      ...topicState,
      exchanges: [...exchanges],
      streamingText: "",
    };
    callbacks.onTopicStateChange(topicState);

    // If human is first speaker, wait for them to read opponent's response before next turn
    if (humanSpeakerId && firstSpeaker.id === humanSpeakerId && callbacks.onWaitForHumanContinue) {
      const isLastTurn = turn === turnsPerTopic;
      await callbacks.onWaitForHumanContinue({
        topicIndex,
        topic,
        turnNumber: turn,
        totalTurns: turnsPerTopic,
        opponentName: secondSpeaker.name,
        opponentMessage: speaker2Message,
        isLastTurn,
      });
    }
  }

  // Judge this topic
  topicState = {
    ...topicState,
    status: "judging",
    currentSpeakerId: null,
    streamingText: "",
  };
  callbacks.onTopicStateChange(topicState);

  const verdict = await judgeTopic(
    topic,
    exchanges,
    firstSpeaker,
    secondSpeaker,
    judge
  );

  topicState = {
    ...topicState,
    status: "complete",
    verdict,
  };
  callbacks.onTopicStateChange(topicState);

  return {
    topic,
    exchanges,
    verdict,
  };
}

async function runSingleDebate(
  match: MatchState,
  debateNumber: number,
  topics: string[],
  callbacks: MatchCallbacks,
  judgePrompt: string
): Promise<{ topicResults: TopicResult[]; speaker1Wins: number; speaker2Wins: number }> {
  const { firstSpeaker, secondSpeaker, config } = match;
  const judge = createJudgeAgent(getModelForRole(config, "judge"), judgePrompt);

  // Determine which speaker is human (if any)
  const humanSpeakerId = config.humanSide === "speaker1"
    ? firstSpeaker.id
    : config.humanSide === "speaker2"
      ? secondSpeaker.id
      : undefined;

  const humanSpeakerPersona = config.humanSide === "speaker1"
    ? config.speaker1Persona
    : config.humanSide === "speaker2"
      ? config.speaker2Persona
      : undefined;

  // If human is playing, run topics sequentially (can't do parallel human input)
  const maxConcurrent = humanSpeakerId ? 1 : MAX_CONCURRENT_TOPICS;
  const pool = new TopicPool(maxConcurrent);

  // Run topics, alternating speaker order to balance second-speaker advantage
  const topicPromises = topics.map((topic, index) => {
    // Alternate who goes first: even index = speaker1 first, odd index = speaker2 first
    const goesFirst = index % 2 === 0 ? firstSpeaker : secondSpeaker;
    const goesSecond = index % 2 === 0 ? secondSpeaker : firstSpeaker;

    return pool.add(() =>
      executeTopic(
        index,
        topic,
        config.turnsPerTopic,
        goesFirst,
        goesSecond,
        judge,
        callbacks,
        config,
        humanSpeakerId,
        humanSpeakerPersona
      )
    );
  });

  const results = await Promise.all(topicPromises);

  // Sort by topic index
  const topicResults = results.sort(
    (a, b) => topics.indexOf(a.topic) - topics.indexOf(b.topic)
  );

  // Calculate tally
  const verdicts = topicResults
    .map((tr) => tr.verdict)
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const finalTally = calculateFinalTally(verdicts, firstSpeaker.id, secondSpeaker.id);

  // Save debate result
  saveDebateResult(match, debateNumber, topicResults, finalTally);

  return {
    topicResults,
    speaker1Wins: finalTally.speaker1Wins,
    speaker2Wins: finalTally.speaker2Wins,
  };
}

export async function runMatch(
  config: MatchConfig,
  callbacks: MatchCallbacks,
  forkFromMatchId?: string
): Promise<MatchState> {
  // Create match (async if seeds need to be generated)
  const { match, judgePrompt } = await createMatch(config, forkFromMatchId);
  callbacks.onMatchStart(match);

  try {
    for (let debateNum = 1; debateNum <= config.totalDebates; debateNum++) {
      logMatchEvent(match.dirPath, "DEBATE_START", `Starting debate ${debateNum}`, { debateNum });
      callbacks.onDebateStart(debateNum);

      // Generate topics for this debate
      const topics = await generateTopics({
        speaker1Name: config.speaker1Name,
        speaker2Name: config.speaker2Name,
        speaker1Persona: config.speaker1Persona,
        speaker2Persona: config.speaker2Persona,
        count: config.topicsPerDebate,
        issueFocus: config.issueFocus || [],
        modelId: getModelForRole(config, "topicGenerator"),
      });

      // Run debate
      const { topicResults, speaker1Wins, speaker2Wins } = await runSingleDebate(
        match,
        debateNum,
        topics,
        callbacks,
        judgePrompt
      );

      logMatchEvent(match.dirPath, "DEBATE_END", `Debate ${debateNum} complete`, {
        debateNum,
        speaker1Wins,
        speaker2Wins
      });
      callbacks.onDebateEnd(debateNum, speaker1Wins, speaker2Wins);

      // Learning phase
      callbacks.onLearning();

      const analysisModel = getModelForRole(config, "analysis");
      await Promise.all([
        updateAgentAfterDebate(
          match.firstSpeaker,
          topicResults,
          match.secondSpeaker,
          analysisModel,
          undefined,
          config.selfImprove
        ),
        updateAgentAfterDebate(
          match.secondSpeaker,
          topicResults,
          match.firstSpeaker,
          analysisModel,
          undefined,
          config.selfImprove
        ),
      ]);

      // Update match state
      match.currentDebateNumber = debateNum;
      match.completedDebates.push({
        debateNumber: debateNum,
        topicResults,
        finalTally: { speaker1Wins, speaker2Wins, ties: config.topicsPerDebate - speaker1Wins - speaker2Wins },
        completedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    logMatchError(match.dirPath, error, "Match execution failed", {
      currentDebate: match.currentDebateNumber,
      completedDebates: match.completedDebates.length
    });
    callbacks.onError(error as Error);
  }

  logMatchEvent(match.dirPath, "MATCH_COMPLETE", "Match finished", {
    completedDebates: match.completedDebates.length,
    totalDebates: config.totalDebates
  });

  callbacks.onMatchEnd(match);

  // Generate and send match summary
  try {
    const summary = await generateMatchSummary(
      config.speaker1Name,
      config.speaker2Name,
      match.completedDebates,
      getModelForRole(config, "summary")
    );
    saveMatchSummary(match.dirPath, summary);
    callbacks.onMatchSummary(summary);

    // Generate issue argument summaries in parallel (non-blocking)
    if (callbacks.onIssueArgumentReady && summary.issues.length > 0) {
      generateIssueArgumentsInBackground(
        summary,
        config.speaker1Name,
        config.speaker2Name,
        match.completedDebates,
        getModelForRole(config, "summary"),
        match.dirPath,
        callbacks.onIssueArgumentReady
      );
    }
  } catch (error) {
    // Don't fail the match if summary fails
    logMatchError(match.dirPath, error, "Failed to generate match summary");
    console.error("Failed to generate match summary:", error);
  }

  return match;
}

export async function resumeMatch(
  matchId: string,
  callbacks: MatchCallbacks
): Promise<MatchState | null> {
  const resumeData = await loadMatchForResume(matchId);

  if (!resumeData) {
    return null;
  }

  const { match, judgePrompt, startFromDebate } = resumeData;
  const { config } = match;

  callbacks.onMatchStart(match);

  try {
    for (let debateNum = startFromDebate; debateNum <= config.totalDebates; debateNum++) {
      logMatchEvent(match.dirPath, "DEBATE_START", `Starting debate ${debateNum}`, { debateNum });
      callbacks.onDebateStart(debateNum);

      // Generate topics for this debate
      const topics = await generateTopics({
        speaker1Name: config.speaker1Name,
        speaker2Name: config.speaker2Name,
        speaker1Persona: config.speaker1Persona,
        speaker2Persona: config.speaker2Persona,
        count: config.topicsPerDebate,
        issueFocus: config.issueFocus || [],
        modelId: getModelForRole(config, "topicGenerator"),
      });

      // Run debate
      const { topicResults, speaker1Wins, speaker2Wins } = await runSingleDebate(
        match,
        debateNum,
        topics,
        callbacks,
        judgePrompt
      );

      logMatchEvent(match.dirPath, "DEBATE_END", `Debate ${debateNum} complete`, {
        debateNum,
        speaker1Wins,
        speaker2Wins
      });
      callbacks.onDebateEnd(debateNum, speaker1Wins, speaker2Wins);

      // Learning phase
      callbacks.onLearning();

      const analysisModel = getModelForRole(config, "analysis");
      await Promise.all([
        updateAgentAfterDebate(
          match.firstSpeaker,
          topicResults,
          match.secondSpeaker,
          analysisModel,
          undefined,
          config.selfImprove
        ),
        updateAgentAfterDebate(
          match.secondSpeaker,
          topicResults,
          match.firstSpeaker,
          analysisModel,
          undefined,
          config.selfImprove
        ),
      ]);

      // Update match state
      match.currentDebateNumber = debateNum;
      match.completedDebates.push({
        debateNumber: debateNum,
        topicResults,
        finalTally: { speaker1Wins, speaker2Wins, ties: config.topicsPerDebate - speaker1Wins - speaker2Wins },
        completedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    logMatchError(match.dirPath, error, "Match execution failed", {
      currentDebate: match.currentDebateNumber,
      completedDebates: match.completedDebates.length
    });
    callbacks.onError(error as Error);
  }

  logMatchEvent(match.dirPath, "MATCH_COMPLETE", "Match finished", {
    completedDebates: match.completedDebates.length,
    totalDebates: config.totalDebates
  });

  callbacks.onMatchEnd(match);

  // Generate and send match summary
  try {
    const summary = await generateMatchSummary(
      config.speaker1Name,
      config.speaker2Name,
      match.completedDebates,
      getModelForRole(config, "summary")
    );
    saveMatchSummary(match.dirPath, summary);
    callbacks.onMatchSummary(summary);

    // Generate issue argument summaries in parallel (non-blocking)
    if (callbacks.onIssueArgumentReady && summary.issues.length > 0) {
      generateIssueArgumentsInBackground(
        summary,
        config.speaker1Name,
        config.speaker2Name,
        match.completedDebates,
        getModelForRole(config, "summary"),
        match.dirPath,
        callbacks.onIssueArgumentReady
      );
    }
  } catch (error) {
    // Don't fail the match if summary fails
    logMatchError(match.dirPath, error, "Failed to generate match summary");
    console.error("Failed to generate match summary:", error);
  }

  return match;
}
