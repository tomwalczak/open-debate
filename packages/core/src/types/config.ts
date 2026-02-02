/**
 * LLM roles in the debate system
 */
export type LLMRole =
  | "speaker1"
  | "speaker2"
  | "judge"
  | "coach"
  | "topicGenerator"
  | "analysis"
  | "promptGenerator"
  | "summary"
  | "nameGenerator"
  | "promptParser";

/**
 * All LLM roles for iteration
 */
export const LLM_ROLES: LLMRole[] = [
  "speaker1",
  "speaker2",
  "judge",
  "coach",
  "topicGenerator",
  "analysis",
  "promptGenerator",
  "summary",
  "nameGenerator",
  "promptParser",
];

/**
 * Model configuration - per-role overrides
 */
export interface ModelConfig {
  /** Default model used when no role-specific model is set */
  default: string;

  /** Model for speaker 1's debate responses */
  speaker1?: string | null;

  /** Model for speaker 2's debate responses */
  speaker2?: string | null;

  /** Model for judging topic verdicts */
  judge?: string | null;

  /** Model for debate coaching/hints */
  coach?: string | null;

  /** Model for generating debate topics */
  topicGenerator?: string | null;

  /** Model for self-analysis after debates */
  analysis?: string | null;

  /** Model for generating/refining agent prompts */
  promptGenerator?: string | null;

  /** Model for match summary generation */
  summary?: string | null;

  /** Model for extracting display names */
  nameGenerator?: string | null;

  /** Model for parsing natural language prompts */
  promptParser?: string | null;
}

/**
 * Debate settings
 */
export interface DebateSettings {
  turnsPerTopic: number;
  topicsPerDebate: number;
  debatesPerMatch: number;
  selfImprove: boolean;
  humanCoach: boolean;
}

/**
 * Output settings
 */
export interface OutputSettings {
  matchesDir: string;
  agentsDir: string;
  logsEnabled: boolean;
}

/**
 * Full configuration file structure
 */
export interface DebateConfigFile {
  $schema?: string;
  models: ModelConfig;
  debate: DebateSettings;
  output: OutputSettings;
}

/**
 * Resolved model configuration (all roles have values, no nulls)
 */
export type ResolvedModelConfig = {
  [K in LLMRole | "default"]: string;
};

/**
 * Resolved configuration (all sources merged, no nulls)
 */
export interface ResolvedConfig {
  models: ResolvedModelConfig;
  debate: DebateSettings;
  output: OutputSettings;
}

/**
 * CLI model overrides parsed from command line
 */
export interface CLIModelOverrides {
  model?: string;
  speaker1Model?: string;
  speaker2Model?: string;
  judgeModel?: string;
  coachModel?: string;
  topicModel?: string;
  analysisModel?: string;
  promptModel?: string;
  summaryModel?: string;
  nameModel?: string;
  parserModel?: string;
}
