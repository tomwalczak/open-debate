import { streamText } from "ai";
import { getModel } from "./model-provider.js";
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
  QuestionExecutionState,
} from "../types/debate.js";

const MAX_CONCURRENT_QUESTIONS = 5;

export interface ParallelDebateCallbacks {
  onStateChange: (state: DebateState) => void;
  onQuestionStateChange: (questionState: QuestionExecutionState) => void;
  onQuestionStreamChunk: (questionIndex: number, chunk: string) => void;
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
  questionIndex: number,
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
  config: DebateConfig,
  firstSpeaker: AgentConfig,
  secondSpeaker: AgentConfig,
  judge: AgentConfig,
  callbacks: ParallelDebateCallbacks
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

  for (let round = 1; round <= config.roundsPerQuestion; round++) {
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
      questionIndex,
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
      questionIndex,
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

export async function runParallelDebate(
  state: DebateState,
  callbacks: ParallelDebateCallbacks,
  selfImprove: boolean = false
): Promise<DebateState> {
  let currentState = { ...state };
  currentState.currentPhase = "debating";
  callbacks.onStateChange(currentState);

  const { config, firstSpeaker, secondSpeaker, judge } = currentState;
  const pool = new QuestionPool(MAX_CONCURRENT_QUESTIONS);

  // Run all questions in parallel (limited by pool)
  const questionPromises = config.questions.map((question, index) =>
    pool.add(() =>
      executeQuestion(
        index,
        question,
        config,
        firstSpeaker,
        secondSpeaker,
        judge,
        callbacks
      )
    )
  );

  try {
    const results = await Promise.all(questionPromises);

    // Sort results by question index to maintain order
    currentState.questionResults = results.sort(
      (a, b) => config.questions.indexOf(a.question) - config.questions.indexOf(b.question)
    );
  } catch (error) {
    callbacks.onError(error as Error);
    return currentState;
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
    currentState.currentPhase = "learning";
    callbacks.onStateChange(currentState);

    try {
      await Promise.all([
        updateAgentAfterDebate(
          firstSpeaker,
          currentState.questionResults,
          secondSpeaker,
          firstSpeaker.modelId,
          undefined,
          selfImprove
        ),
        updateAgentAfterDebate(
          secondSpeaker,
          currentState.questionResults,
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

  const { firstSpeaker, secondSpeaker, questionResults } = currentState;

  try {
    await Promise.all([
      updateAgentAfterDebate(
        firstSpeaker,
        questionResults,
        secondSpeaker,
        firstSpeaker.modelId,
        humanFeedback,
        selfImprove
      ),
      updateAgentAfterDebate(
        secondSpeaker,
        questionResults,
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
