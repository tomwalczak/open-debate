import { streamText } from "ai";
import { getModel } from "./openrouter.js";
import { createAgent } from "./agent-storage.js";
import { createJudgeAgent } from "./agent-factory.js";
import { judgeQuestion, calculateFinalTally } from "./judge-service.js";
import { updateAgentAfterDebate } from "./agent-learner.js";
import { generateDebateId, generateId } from "../utils/id.js";
import { saveDebateLogs } from "../utils/logger.js";
import type { AgentConfig } from "../types/agent.js";
import type {
  DebateState,
  DebateConfig,
  Exchange,
  QuestionResult,
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
    currentQuestionIndex: 0,
    currentRound: 1,
    currentPhase: "setup",
    currentSpeakerId: null,
    questionResults: [],
    finalTally: null,
    streamingMessage: "",
  };

  callbacks.onStateChange(state);
  return state;
}

async function generateSpeakerResponse(
  speaker: AgentConfig,
  question: string,
  previousExchanges: Exchange[],
  roundNumber: number,
  callbacks: DebateEngineCallbacks
): Promise<string> {
  const messages = previousExchanges.map((ex) => ({
    role: ex.speakerId === speaker.id ? ("assistant" as const) : ("user" as const),
    content: ex.message,
  }));

  const systemPrompt = `${speaker.systemPrompt}

Current debate question: ${question}
You are in round ${roundNumber} of this debate.

Be concise.`;

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

  for (let qIndex = 0; qIndex < config.questions.length; qIndex++) {
    const question = config.questions[qIndex];
    const exchanges: Exchange[] = [];

    currentState.currentQuestionIndex = qIndex;
    callbacks.onStateChange(currentState);

    for (let round = 1; round <= config.roundsPerQuestion; round++) {
      currentState.currentRound = round;

      // First speaker
      currentState.currentSpeakerId = firstSpeaker.id;
      currentState.streamingMessage = "";
      callbacks.onStateChange(currentState);

      const speaker1Message = await generateSpeakerResponse(
        firstSpeaker,
        question,
        exchanges,
        round,
        callbacks
      );

      exchanges.push({
        id: generateId(),
        speakerId: firstSpeaker.id,
        speakerName: firstSpeaker.name,
        message: speaker1Message,
        roundNumber: round,
        questionIndex: qIndex,
      });

      // Second speaker
      currentState.currentSpeakerId = secondSpeaker.id;
      currentState.streamingMessage = "";
      callbacks.onStateChange(currentState);

      const speaker2Message = await generateSpeakerResponse(
        secondSpeaker,
        question,
        exchanges,
        round,
        callbacks
      );

      exchanges.push({
        id: generateId(),
        speakerId: secondSpeaker.id,
        speakerName: secondSpeaker.name,
        message: speaker2Message,
        roundNumber: round,
        questionIndex: qIndex,
      });
    }

    // Judge this question
    currentState.currentPhase = "judging";
    currentState.currentSpeakerId = null;
    currentState.streamingMessage = "";
    callbacks.onStateChange(currentState);

    const verdict = await judgeQuestion(
      question,
      exchanges,
      firstSpeaker,
      secondSpeaker,
      judge
    );

    const questionResult: QuestionResult = {
      question,
      exchanges,
      verdict,
    };

    currentState.questionResults.push(questionResult);
    currentState.currentPhase = "debating";
    callbacks.onStateChange(currentState);
  }

  // Calculate final tally
  const verdicts = currentState.questionResults
    .map((qr) => qr.verdict)
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
          currentState.questionResults,
          secondSpeaker,
          firstSpeaker.modelId
        ),
        updateAgentAfterDebate(
          secondSpeaker,
          currentState.questionResults,
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

  const { firstSpeaker, secondSpeaker, questionResults } = currentState;

  // Trigger agent learning for both speakers with human feedback
  try {
    await Promise.all([
      updateAgentAfterDebate(
        firstSpeaker,
        questionResults,
        secondSpeaker,
        firstSpeaker.modelId,
        humanFeedback
      ),
      updateAgentAfterDebate(
        secondSpeaker,
        questionResults,
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
