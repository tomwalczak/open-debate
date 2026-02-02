import { streamText } from "./llm.js";
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
} from "../types/debate.js";

export interface DebateEngineCallbacks {
  onStateChange: (state: DebateState) => void;
  onStreamChunk: (chunk: string) => void;
  onError: (error: Error) => void;
}

export function initializeDebate(
  speaker1Name: string,
  speaker2Name: string,
  config: DebateConfig,
  modelId: string,
  callbacks: DebateEngineCallbacks,
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

async function generateSpeakerResponse(
  speaker: AgentConfig,
  topic: string,
  previousExchanges: Exchange[],
  turnNumber: number,
  callbacks: DebateEngineCallbacks
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
    callbacks.onStreamChunk(chunk);
  }

  return fullMessage;
}

export async function runDebate(
  state: DebateState,
  callbacks: DebateEngineCallbacks
): Promise<DebateState> {
  let currentState = { ...state };
  currentState.currentPhase = "debating";
  callbacks.onStateChange(currentState);

  const { config, firstSpeaker, secondSpeaker, judge } = currentState;

  for (let tIndex = 0; tIndex < config.topics.length; tIndex++) {
    const topic = config.topics[tIndex];
    const exchanges: Exchange[] = [];

    currentState.currentTopicIndex = tIndex;
    callbacks.onStateChange(currentState);

    for (let turn = 1; turn <= config.turnsPerTopic; turn++) {
      currentState.currentTurn = turn;

      // First speaker
      currentState.currentSpeakerId = firstSpeaker.id;
      currentState.streamingMessage = "";
      callbacks.onStateChange(currentState);

      const speaker1Message = await generateSpeakerResponse(
        firstSpeaker,
        topic,
        exchanges,
        turn,
        callbacks
      );

      exchanges.push({
        id: generateId(),
        speakerId: firstSpeaker.id,
        speakerName: firstSpeaker.name,
        message: speaker1Message,
        turnNumber: turn,
        topicIndex: tIndex,
      });

      // Second speaker
      currentState.currentSpeakerId = secondSpeaker.id;
      currentState.streamingMessage = "";
      callbacks.onStateChange(currentState);

      const speaker2Message = await generateSpeakerResponse(
        secondSpeaker,
        topic,
        exchanges,
        turn,
        callbacks
      );

      exchanges.push({
        id: generateId(),
        speakerId: secondSpeaker.id,
        speakerName: secondSpeaker.name,
        message: speaker2Message,
        turnNumber: turn,
        topicIndex: tIndex,
      });
    }

    // Judge this topic
    currentState.currentPhase = "judging";
    currentState.currentSpeakerId = null;
    currentState.streamingMessage = "";
    callbacks.onStateChange(currentState);

    const verdict = await judgeTopic(
      topic,
      exchanges,
      firstSpeaker,
      secondSpeaker,
      judge
    );

    const topicResult: TopicResult = {
      topic,
      exchanges,
      verdict,
    };

    currentState.topicResults.push(topicResult);
    currentState.currentPhase = "debating";
    callbacks.onStateChange(currentState);
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
    // Trigger agent learning for both speakers
    currentState.currentPhase = "learning";
    callbacks.onStateChange(currentState);

    try {
      await Promise.all([
        updateAgentAfterDebate(
          firstSpeaker,
          currentState.topicResults,
          secondSpeaker,
          firstSpeaker.modelId
        ),
        updateAgentAfterDebate(
          secondSpeaker,
          currentState.topicResults,
          firstSpeaker,
          secondSpeaker.modelId
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

export async function completeDebateWithHumanFeedback(
  state: DebateState,
  humanFeedback: string,
  callbacks: DebateEngineCallbacks
): Promise<DebateState> {
  let currentState: DebateState = {
    ...state,
    humanFeedback,
    currentPhase: "learning",
  };

  callbacks.onStateChange(currentState);

  const { firstSpeaker, secondSpeaker, topicResults } = currentState;

  // Trigger agent learning for both speakers with human feedback
  try {
    await Promise.all([
      updateAgentAfterDebate(
        firstSpeaker,
        topicResults,
        secondSpeaker,
        firstSpeaker.modelId,
        humanFeedback
      ),
      updateAgentAfterDebate(
        secondSpeaker,
        topicResults,
        firstSpeaker,
        secondSpeaker.modelId,
        humanFeedback
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
