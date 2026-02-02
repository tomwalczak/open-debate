import type { AgentConfig } from "./agent.js";
import type { JudgeVerdict, FinalTally } from "./judge.js";
import type { ResolvedModelConfig } from "./config.js";

// Match = series of debates between two speakers
export interface MatchConfig {
  speaker1Name: string;  // Display name (short, for UI)
  speaker2Name: string;  // Display name (short, for UI)
  speaker1Persona?: string;  // Full persona description (for prompt generation)
  speaker2Persona?: string;  // Full persona description (for prompt generation)
  totalDebates: number;
  topicsPerDebate: number;
  turnsPerTopic: number;
  humanCoachEnabled: boolean;
  selfImprove: boolean;
  issueFocus?: string[];
  modelId: string;  // Default model (backward compat) - use models.default if available
  models?: ResolvedModelConfig;  // Per-role model configuration
  seed1?: string;  // User instructions for speaker 1's initial prompt
  seed2?: string;  // User instructions for speaker 2's initial prompt
  directPrompt1?: string;  // Direct system prompt for speaker 1 (bypasses generation)
  directPrompt2?: string;  // Direct system prompt for speaker 2 (bypasses generation)
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
  topicResults: TopicResult[];
  finalTally: FinalTally;
  completedAt: string;
}

export type TopicStatus = "pending" | "debating" | "judging" | "complete";

export interface TopicExecutionState {
  topicIndex: number;
  topic: string;
  status: TopicStatus;
  currentTurn: number;
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
  turnNumber: number;
  topicIndex: number;
}

export interface TopicResult {
  topic: string;
  exchanges: Exchange[];
  verdict: JudgeVerdict | null;
}

export interface DebateConfig {
  topics: string[];
  turnsPerTopic: number;
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

  currentTopicIndex: number;
  currentTurn: number;
  currentPhase: DebatePhase;
  currentSpeakerId: string | null;

  topicResults: TopicResult[];
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
    | "ready";
  speaker1Name: string;  // Display name (short)
  speaker2Name: string;  // Display name (short)
  speaker1Persona: string;  // Full persona description
  speaker2Persona: string;  // Full persona description
  turnsPerTopic: number;
  topicCount: number;
  debateCount: number;
  issueFocus: string[];
}

export const DEFAULT_WIZARD_STATE: WizardState = {
  step: "speakers",
  speaker1Name: "",
  speaker2Name: "",
  speaker1Persona: "",
  speaker2Persona: "",
  turnsPerTopic: 5,
  topicCount: 5,
  debateCount: 1,
  issueFocus: [],
};
