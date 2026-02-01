import { streamText } from "ai";
import { getModel } from "./model-provider.js";
import { createAgent } from "./agent-storage.js";
import { createJudgeAgent } from "./agent-factory.js";
import { judgeTopic, calculateFinalTally } from "./judge-service.js";
import { updateAgentAfterDebate } from "./agent-learner.js";
import { generateDebateId, generateId } from "../utils/id.js";
import { saveDebateLogs } from "../utils/logger.js";
import type { AgentConfig } from "../types/agent.js";
import type {
  DebateState,
  DebateConfig,
  Exchange,
  TopicResult,
  TopicExecutionState,
} from "../types/debate.js";

const MAX_CONCURRENT_TOPICS = 5;

export interface ParallelDebateCallbacks {
  onStateChange: (state: DebateState) => void;
  onTopicStateChange: (topicState: TopicExecutionState) => void;
  onTopicStreamChunk: (topicIndex: number, chunk: string) => void;
  onError: (error: Error) => void;
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
  topicIndex: number,
  onChunk: (chunk: string) => void
): Promise<string> {
  const messages = previousExchanges.map((ex) => ({
    role: ex.speakerId === speaker.id ? ("assistant" as const) : ("user" as const),
    content: ex.message,
  }));

  const systemPrompt = `${speaker.systemPrompt}

Current debate topic: ${topic}
You are in turn ${turnNumber} of this debate.

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
  config: DebateConfig,
  firstSpeaker: AgentConfig,
  secondSpeaker: AgentConfig,
  judge: AgentConfig,
  callbacks: ParallelDebateCallbacks
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

  for (let turn = 1; turn <= config.turnsPerTopic; turn++) {
    topicState = { ...topicState, currentTurn: turn };

    // First speaker
    topicState = {
      ...topicState,
      currentSpeakerId: firstSpeaker.id,
      streamingText: "",
    };
    callbacks.onTopicStateChange(topicState);

    const speaker1Message = await generateSpeakerResponse(
      firstSpeaker,
      topic,
      exchanges,
      turn,
      topicIndex,
      (chunk) => {
        topicState = {
          ...topicState,
          streamingText: topicState.streamingText + chunk,
        };
        callbacks.onTopicStreamChunk(topicIndex, chunk);
        callbacks.onTopicStateChange(topicState);
      }
    );

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

    // Second speaker
    topicState = {
      ...topicState,
      currentSpeakerId: secondSpeaker.id,
      streamingText: "",
    };
    callbacks.onTopicStateChange(topicState);

    const speaker2Message = await generateSpeakerResponse(
      secondSpeaker,
      topic,
      exchanges,
      turn,
      topicIndex,
      (chunk) => {
        topicState = {
          ...topicState,
          streamingText: topicState.streamingText + chunk,
        };
        callbacks.onTopicStreamChunk(topicIndex, chunk);
        callbacks.onTopicStateChange(topicState);
      }
    );

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

export function initializeParallelDebate(
  speaker1Name: string,
  speaker2Name: string,
  config: DebateConfig,
  modelId: string,
  callbacks: ParallelDebateCallbacks,
  fork: boolean = false
): DebateState {
  const firstSpeaker = createAgent(speaker1Name, modelId, fork);
  const secondSpeaker = createAgent(speaker2Name, modelId, fork);
  const judge = createJudgeAgent(modelId);

  const state: DebateState = {
    id: generateDebateId(speaker1Name, speaker2Name),
    config,
    firstSpeaker,
    secondSpeaker,
    judge,
    currentTopicIndex: 0,
    currentTurn: 1,
    currentPhase: "setup",
    currentSpeakerId: null,
    topicResults: [],
    finalTally: null,
    streamingMessage: "",
  };

  callbacks.onStateChange(state);
  return state;
}

export async function runParallelDebate(
  state: DebateState,
  callbacks: ParallelDebateCallbacks,
  selfImprove: boolean = false
): Promise<DebateState> {
  let currentState = { ...state };
  currentState.currentPhase = "debating";
  callbacks.onStateChange(currentState);

  const { config, firstSpeaker, secondSpeaker, judge } = currentState;
  const pool = new TopicPool(MAX_CONCURRENT_TOPICS);

  // Run all topics in parallel (limited by pool)
  const topicPromises = config.topics.map((topic, index) =>
    pool.add(() =>
      executeTopic(
        index,
        topic,
        config,
        firstSpeaker,
        secondSpeaker,
        judge,
        callbacks
      )
    )
  );

  try {
    const results = await Promise.all(topicPromises);

    // Sort results by topic index to maintain order
    currentState.topicResults = results.sort(
      (a, b) => config.topics.indexOf(a.topic) - config.topics.indexOf(b.topic)
    );
  } catch (error) {
    callbacks.onError(error as Error);
    return currentState;
  }

  // Calculate final tally
  const verdicts = currentState.topicResults
    .map((tr) => tr.verdict)
    .filter((v): v is NonNullable<typeof v> => v !== null);

  currentState.finalTally = calculateFinalTally(
    verdicts,
    firstSpeaker.id,
    secondSpeaker.id
  );

  // Move to human feedback if enabled, otherwise trigger learning
  if (config.humanCoachEnabled) {
    currentState.currentPhase = "human_feedback";
  } else {
    currentState.currentPhase = "learning";
    callbacks.onStateChange(currentState);

    try {
      await Promise.all([
        updateAgentAfterDebate(
          firstSpeaker,
          currentState.topicResults,
          secondSpeaker,
          firstSpeaker.modelId,
          undefined,
          selfImprove
        ),
        updateAgentAfterDebate(
          secondSpeaker,
          currentState.topicResults,
          firstSpeaker,
          secondSpeaker.modelId,
          undefined,
          selfImprove
        ),
      ]);
    } catch (error) {
      callbacks.onError(error as Error);
    }

    currentState.currentPhase = "complete";
    saveDebateLogs(currentState);
  }

  callbacks.onStateChange(currentState);
  return currentState;
}

export async function completeParallelDebateWithHumanFeedback(
  state: DebateState,
  humanFeedback: string,
  callbacks: ParallelDebateCallbacks,
  selfImprove: boolean = false
): Promise<DebateState> {
  let currentState: DebateState = {
    ...state,
    humanFeedback,
    currentPhase: "learning",
  };

  callbacks.onStateChange(currentState);

  const { firstSpeaker, secondSpeaker, topicResults } = currentState;

  try {
    await Promise.all([
      updateAgentAfterDebate(
        firstSpeaker,
        topicResults,
        secondSpeaker,
        firstSpeaker.modelId,
        humanFeedback,
        selfImprove
      ),
      updateAgentAfterDebate(
        secondSpeaker,
        topicResults,
        firstSpeaker,
        secondSpeaker.modelId,
        humanFeedback,
        selfImprove
      ),
    ]);
  } catch (error) {
    callbacks.onError(error as Error);
  }

  currentState = { ...currentState, currentPhase: "complete" };
  saveDebateLogs(currentState);
  callbacks.onStateChange(currentState);

  return currentState;
}
