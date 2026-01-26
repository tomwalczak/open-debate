import { streamText } from "ai";
import { getModel } from "./openrouter.js";
import { createJudgeAgent } from "./agent-factory.js";
import { judgeQuestion, calculateFinalTally } from "./judge-service.js";
import { updateAgentAfterDebate } from "./agent-learner.js";
import { createMatch, saveDebateResult } from "./match-storage.js";
import { generateQuestions } from "./question-generator.js";
import { generateId } from "../utils/id.js";
import type { AgentConfig } from "../types/agent.js";
import type {
  MatchConfig,
  MatchState,
  DebateConfig,
  Exchange,
  QuestionResult,
  QuestionExecutionState,
} from "../types/debate.js";

const MAX_CONCURRENT_QUESTIONS = 5;

export interface MatchCallbacks {
  onMatchStart: (match: MatchState) => void;
  onDebateStart: (debateNumber: number) => void;
  onDebateEnd: (debateNumber: number, speaker1Wins: number, speaker2Wins: number) => void;
  onMatchEnd: (match: MatchState) => void;
  onQuestionStateChange: (questionState: QuestionExecutionState) => void;
  onQuestionStreamChunk: (questionIndex: number, chunk: string) => void;
  onLearning: () => void;
  onError: (error: Error) => void;
}

class QuestionPool {
  private running = 0;
  private queue: Array<() => Promise<void>> = [];
  private maxConcurrent: number;

  constructor(maxConcurrent: number = MAX_CONCURRENT_QUESTIONS) {
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
  question: string,
  previousExchanges: Exchange[],
  roundNumber: number,
  onChunk: (chunk: string) => void
): Promise<string> {
  const messages = previousExchanges.map((ex) => ({
    role: ex.speakerId === speaker.id ? ("assistant" as const) : ("user" as const),
    content: ex.message,
  }));

  const systemPrompt = `${speaker.systemPrompt}

Current debate question: ${question}
You are in round ${roundNumber} of this debate.

Be concise. Keep your response under 300 words.`;

  let fullMessage = "";

  const result = await streamText({
    model: getModel(speaker.modelId),
    system: systemPrompt,
    messages:
      messages.length > 0
        ? messages
        : [{ role: "user" as const, content: `Please argue your position on: ${question}` }],
  });

  for await (const chunk of result.textStream) {
    fullMessage += chunk;
    onChunk(chunk);
  }

  return fullMessage;
}

async function executeQuestion(
  questionIndex: number,
  question: string,
  roundsPerQuestion: number,
  firstSpeaker: AgentConfig,
  secondSpeaker: AgentConfig,
  judge: AgentConfig,
  callbacks: MatchCallbacks
): Promise<QuestionResult> {
  const exchanges: Exchange[] = [];

  let questionState: QuestionExecutionState = {
    questionIndex,
    question,
    status: "debating",
    currentRound: 1,
    currentSpeakerId: null,
    exchanges: [],
    streamingText: "",
    verdict: null,
  };

  callbacks.onQuestionStateChange(questionState);

  for (let round = 1; round <= roundsPerQuestion; round++) {
    questionState = { ...questionState, currentRound: round };

    // First speaker
    questionState = {
      ...questionState,
      currentSpeakerId: firstSpeaker.id,
      streamingText: "",
    };
    callbacks.onQuestionStateChange(questionState);

    const speaker1Message = await generateSpeakerResponse(
      firstSpeaker,
      question,
      exchanges,
      round,
      (chunk) => {
        questionState = {
          ...questionState,
          streamingText: questionState.streamingText + chunk,
        };
        callbacks.onQuestionStreamChunk(questionIndex, chunk);
        callbacks.onQuestionStateChange(questionState);
      }
    );

    const exchange1: Exchange = {
      id: generateId(),
      speakerId: firstSpeaker.id,
      speakerName: firstSpeaker.name,
      message: speaker1Message,
      roundNumber: round,
      questionIndex,
    };
    exchanges.push(exchange1);
    questionState = {
      ...questionState,
      exchanges: [...exchanges],
      streamingText: "",
    };
    callbacks.onQuestionStateChange(questionState);

    // Second speaker
    questionState = {
      ...questionState,
      currentSpeakerId: secondSpeaker.id,
      streamingText: "",
    };
    callbacks.onQuestionStateChange(questionState);

    const speaker2Message = await generateSpeakerResponse(
      secondSpeaker,
      question,
      exchanges,
      round,
      (chunk) => {
        questionState = {
          ...questionState,
          streamingText: questionState.streamingText + chunk,
        };
        callbacks.onQuestionStreamChunk(questionIndex, chunk);
        callbacks.onQuestionStateChange(questionState);
      }
    );

    const exchange2: Exchange = {
      id: generateId(),
      speakerId: secondSpeaker.id,
      speakerName: secondSpeaker.name,
      message: speaker2Message,
      roundNumber: round,
      questionIndex,
    };
    exchanges.push(exchange2);
    questionState = {
      ...questionState,
      exchanges: [...exchanges],
      streamingText: "",
    };
    callbacks.onQuestionStateChange(questionState);
  }

  // Judge this question
  questionState = {
    ...questionState,
    status: "judging",
    currentSpeakerId: null,
    streamingText: "",
  };
  callbacks.onQuestionStateChange(questionState);

  const verdict = await judgeQuestion(
    question,
    exchanges,
    firstSpeaker,
    secondSpeaker,
    judge
  );

  questionState = {
    ...questionState,
    status: "complete",
    verdict,
  };
  callbacks.onQuestionStateChange(questionState);

  return {
    question,
    exchanges,
    verdict,
  };
}

async function runSingleDebate(
  match: MatchState,
  debateNumber: number,
  questions: string[],
  callbacks: MatchCallbacks
): Promise<{ questionResults: QuestionResult[]; speaker1Wins: number; speaker2Wins: number }> {
  const { firstSpeaker, secondSpeaker, config } = match;
  const judge = createJudgeAgent(config.modelId);
  const pool = new QuestionPool(MAX_CONCURRENT_QUESTIONS);

  // Run all questions in parallel, alternating speaker order to balance second-speaker advantage
  const questionPromises = questions.map((question, index) => {
    // Alternate who goes first: even index = speaker1 first, odd index = speaker2 first
    const goesFirst = index % 2 === 0 ? firstSpeaker : secondSpeaker;
    const goesSecond = index % 2 === 0 ? secondSpeaker : firstSpeaker;

    return pool.add(() =>
      executeQuestion(
        index,
        question,
        config.roundsPerQuestion,
        goesFirst,
        goesSecond,
        judge,
        callbacks
      )
    );
  });

  const results = await Promise.all(questionPromises);

  // Sort by question index
  const questionResults = results.sort(
    (a, b) => questions.indexOf(a.question) - questions.indexOf(b.question)
  );

  // Calculate tally
  const verdicts = questionResults
    .map((qr) => qr.verdict)
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const finalTally = calculateFinalTally(verdicts, firstSpeaker.id, secondSpeaker.id);

  // Save debate result
  saveDebateResult(match, debateNumber, questionResults, finalTally);

  return {
    questionResults,
    speaker1Wins: finalTally.speaker1Wins,
    speaker2Wins: finalTally.speaker2Wins,
  };
}

export async function runMatch(
  config: MatchConfig,
  callbacks: MatchCallbacks,
  forkFromMatchId?: string
): Promise<MatchState> {
  // Create match
  const match = createMatch(config, forkFromMatchId);
  callbacks.onMatchStart(match);

  try {
    for (let debateNum = 1; debateNum <= config.totalDebates; debateNum++) {
      callbacks.onDebateStart(debateNum);

      // Generate questions for this debate
      const questions = await generateQuestions({
        speaker1Name: config.speaker1Name,
        speaker2Name: config.speaker2Name,
        count: config.questionsPerDebate,
        issueFocus: config.issueFocus || [],
        modelId: config.modelId,
      });

      // Run debate
      const { questionResults, speaker1Wins, speaker2Wins } = await runSingleDebate(
        match,
        debateNum,
        questions,
        callbacks
      );

      callbacks.onDebateEnd(debateNum, speaker1Wins, speaker2Wins);

      // Learning phase
      callbacks.onLearning();

      await Promise.all([
        updateAgentAfterDebate(
          match.firstSpeaker,
          questionResults,
          match.secondSpeaker,
          match.firstSpeaker.modelId,
          undefined,
          config.selfImprove
        ),
        updateAgentAfterDebate(
          match.secondSpeaker,
          questionResults,
          match.firstSpeaker,
          match.secondSpeaker.modelId,
          undefined,
          config.selfImprove
        ),
      ]);

      // Update match state
      match.currentDebateNumber = debateNum;
      match.completedDebates.push({
        debateNumber: debateNum,
        questionResults,
        finalTally: { speaker1Wins, speaker2Wins, ties: config.questionsPerDebate - speaker1Wins - speaker2Wins },
        completedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    callbacks.onError(error as Error);
  }

  callbacks.onMatchEnd(match);
  return match;
}
