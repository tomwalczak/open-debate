import type { AgentConfig } from "./agent.js";
import type { JudgeVerdict, FinalTally } from "./judge.js";

// Match = series of debates between two speakers
export interface MatchConfig {
  speaker1Name: string;  // Display name (short, for UI)
  speaker2Name: string;  // Display name (short, for UI)
  speaker1Persona?: string;  // Full persona description (for prompt generation)
  speaker2Persona?: string;  // Full persona description (for prompt generation)
  totalDebates: number;
  questionsPerDebate: number;
  roundsPerQuestion: number;
  humanCoachEnabled: boolean;
  selfImprove: boolean;
  issueFocus?: string[];
  modelId: string;
  seed1?: string;  // User instructions for speaker 1's initial prompt
  seed2?: string;  // User instructions for speaker 2's initial prompt
  directPrompt1?: string;  // Direct system prompt for speaker 1 (bypasses generation)
  directPrompt2?: string;  // Direct system prompt for speaker 2 (bypasses generation)
  narrate?: boolean;  // Enable real-time narrator commentary
  judgeSeed?: string;  // Instructions for judge persona
  humanSide?: "speaker1" | "speaker2";  // Which side the human plays
}

export interface MatchState {
  id: string;  // adj-noun format
  dirPath: string;
  config: MatchConfig;
  currentDebateNumber: number;
  completedDebates: DebateResult[];
  firstSpeaker: AgentConfig;
  secondSpeaker: AgentConfig;
}

export interface DebateResult {
  debateNumber: number;
  questionResults: QuestionResult[];
  finalTally: FinalTally;
  completedAt: string;
}

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
  narratorSummary?: string;  // Current summary being displayed
  isNarratorStreaming?: boolean;  // True when narrator is actively streaming
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
    | "confirm"      // Quick start confirmation
    | "settings"     // Only if user chooses to edit
    | "topic_focus"
    | "options"
    | "ready";
  speaker1Name: string;  // Display name (short)
  speaker2Name: string;  // Display name (short)
  speaker1Persona: string;  // Full persona description
  speaker2Persona: string;  // Full persona description
  roundsPerQuestion: number;
  questionCount: number;
  debateCount: number;
  issueFocus: string[];
  narrate: boolean;
}

export const DEFAULT_WIZARD_STATE: WizardState = {
  step: "speakers",
  speaker1Name: "",
  speaker2Name: "",
  speaker1Persona: "",
  speaker2Persona: "",
  roundsPerQuestion: 5,
  questionCount: 5,
  debateCount: 1,
  issueFocus: [],
  narrate: false, // Default to narrator off
};
