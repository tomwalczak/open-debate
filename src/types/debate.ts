import type { AgentConfig } from "./agent.js";
import type { JudgeVerdict, FinalTally } from "./judge.js";

export type QuestionStatus = "pending" | "debating" | "judging" | "complete";

export interface QuestionExecutionState {
  questionIndex: number;
  question: string;
  status: QuestionStatus;
  currentRound: number;
  currentSpeakerId: string | null;
  exchanges: Exchange[];
  streamingText: string;
  verdict: JudgeVerdict | null;
}

export interface Exchange {
  id: string;
  speakerId: string;
  speakerName: string;
  message: string;
  roundNumber: number;
  questionIndex: number;
}

export interface QuestionResult {
  question: string;
  exchanges: Exchange[];
  verdict: JudgeVerdict | null;
}

export interface DebateConfig {
  questions: string[];
  roundsPerQuestion: number;
  humanCoachEnabled: boolean;
  issueFocus?: string[];
}

export type DebatePhase =
  | "setup"
  | "debating"
  | "judging"
  | "learning"
  | "human_feedback"
  | "complete";

export interface DebateState {
  id: string;
  config: DebateConfig;
  firstSpeaker: AgentConfig;
  secondSpeaker: AgentConfig;
  judge: AgentConfig;

  currentQuestionIndex: number;
  currentRound: number;
  currentPhase: DebatePhase;
  currentSpeakerId: string | null;

  questionResults: QuestionResult[];
  finalTally: FinalTally | null;
  humanFeedback?: string;

  streamingMessage: string;
  error?: string;
}

export interface WizardState {
  step:
    | "speakers"
    | "settings"
    | "topic_focus"
    | "question_review"
    | "coach_toggle"
    | "ready";
  speaker1Name: string;
  speaker2Name: string;
  roundsPerQuestion: number;
  questionCount: number;
  issueFocus: string[];
  questions: string[];
  humanCoachEnabled: boolean;
}

export const DEFAULT_WIZARD_STATE: WizardState = {
  step: "speakers",
  speaker1Name: "",
  speaker2Name: "",
  roundsPerQuestion: 3,
  questionCount: 5,
  issueFocus: [],
  questions: [],
  humanCoachEnabled: false,
};
