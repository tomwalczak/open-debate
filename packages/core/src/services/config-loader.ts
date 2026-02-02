import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import type {
  DebateConfigFile,
  ResolvedConfig,
  LLMRole,
  ModelConfig,
  CLIModelOverrides,
  DebateSettings,
  OutputSettings,
  ResolvedModelConfig,
} from "../types/config.js";
import { DEFAULT_MODEL_ID } from "../types/agent.js";

const CONFIG_FILENAMES = ["debate.config.json", ".debate.config.json"];
const USER_CONFIG_DIR = join(homedir(), ".config", "open-debate");
const USER_CONFIG_PATH = join(USER_CONFIG_DIR, "config.json");

/**
 * Default model configuration
 */
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  default: DEFAULT_MODEL_ID,
  speaker1: null,
  speaker2: null,
  judge: null,
  coach: null,
  topicGenerator: null,
  narrator: null,
  analysis: null,
  promptGenerator: null,
  summary: null,
  nameGenerator: null,
  promptParser: null,
};

/**
 * Default debate settings
 */
export const DEFAULT_DEBATE_SETTINGS: DebateSettings = {
  turnsPerTopic: 5,
  topicsPerDebate: 5,
  debatesPerMatch: 1,
  narrate: false,
  selfImprove: false,
  humanCoach: false,
};

/**
 * Default output settings
 */
export const DEFAULT_OUTPUT_SETTINGS: OutputSettings = {
  matchesDir: "./matches",
  agentsDir: "./agents",
  logsEnabled: true,
};

/**
 * Full default configuration
 */
export const DEFAULT_CONFIG: DebateConfigFile = {
  models: DEFAULT_MODEL_CONFIG,
  debate: DEFAULT_DEBATE_SETTINGS,
  output: DEFAULT_OUTPUT_SETTINGS,
};

/**
 * Find project config file path
 */
export function findProjectConfigPath(cwd: string = process.cwd()): string | null {
  for (const filename of CONFIG_FILENAMES) {
    const filepath = join(cwd, filename);
    if (existsSync(filepath)) {
      return filepath;
    }
  }
  return null;
}

/**
 * Load and parse a config file
 */
function loadConfigFile(filepath: string): Partial<DebateConfigFile> | null {
  try {
    const content = readFileSync(filepath, "utf-8");
    return JSON.parse(content);
  } catch (e) {
    console.warn(`Warning: Failed to parse ${filepath}: ${e}`);
    return null;
  }
}

/**
 * Find and load project config file
 */
function loadProjectConfig(cwd: string = process.cwd()): Partial<DebateConfigFile> | null {
  const filepath = findProjectConfigPath(cwd);
  if (filepath) {
    return loadConfigFile(filepath);
  }
  return null;
}

/**
 * Load user config from ~/.config/open-debate/config.json
 */
function loadUserConfig(): Partial<DebateConfigFile> | null {
  if (existsSync(USER_CONFIG_PATH)) {
    return loadConfigFile(USER_CONFIG_PATH);
  }
  return null;
}

/**
 * Deep merge two objects (override takes precedence)
 */
function deepMerge(base: DebateConfigFile, override: Partial<DebateConfigFile>): DebateConfigFile {
  return {
    $schema: override.$schema ?? base.$schema,
    models: {
      ...base.models,
      ...(override.models || {}),
    },
    debate: {
      ...base.debate,
      ...(override.debate || {}),
    },
    output: {
      ...base.output,
      ...(override.output || {}),
    },
  };
}

/**
 * Map CLI flag names to LLM roles
 */
const CLI_TO_ROLE_MAP: Record<keyof Omit<CLIModelOverrides, "model">, LLMRole> = {
  speaker1Model: "speaker1",
  speaker2Model: "speaker2",
  judgeModel: "judge",
  coachModel: "coach",
  topicModel: "topicGenerator",
  narratorModel: "narrator",
  analysisModel: "analysis",
  promptModel: "promptGenerator",
  summaryModel: "summary",
  nameModel: "nameGenerator",
  parserModel: "promptParser",
};

/**
 * Load and merge all configuration sources
 */
export function loadConfig(cliOverrides?: CLIModelOverrides): ResolvedConfig {
  // Load configs in priority order (lowest to highest)
  const userConfig = loadUserConfig() || {};
  const projectConfig = loadProjectConfig() || {};

  // Merge: defaults <- user <- project
  let config = deepMerge(DEFAULT_CONFIG, userConfig as Partial<DebateConfigFile>);
  config = deepMerge(config, projectConfig as Partial<DebateConfigFile>);

  // Apply CLI --model flag as default
  if (cliOverrides?.model) {
    config.models.default = cliOverrides.model;
  }

  // Apply per-role CLI overrides
  for (const [cliKey, role] of Object.entries(CLI_TO_ROLE_MAP)) {
    const value = cliOverrides?.[cliKey as keyof CLIModelOverrides];
    if (value) {
      config.models[role] = value;
    }
  }

  // Resolve all null/undefined values to default
  const defaultModel = config.models.default;
  const resolvedModels: ResolvedModelConfig = {
    default: defaultModel,
    speaker1: config.models.speaker1 || defaultModel,
    speaker2: config.models.speaker2 || defaultModel,
    judge: config.models.judge || defaultModel,
    coach: config.models.coach || defaultModel,
    topicGenerator: config.models.topicGenerator || defaultModel,
    narrator: config.models.narrator || defaultModel,
    analysis: config.models.analysis || defaultModel,
    promptGenerator: config.models.promptGenerator || defaultModel,
    summary: config.models.summary || defaultModel,
    nameGenerator: config.models.nameGenerator || defaultModel,
    promptParser: config.models.promptParser || defaultModel,
  };

  return {
    models: resolvedModels,
    debate: config.debate,
    output: config.output,
  };
}

/**
 * Get model for a specific role
 */
export function getModelForRole(role: LLMRole, config: ResolvedConfig): string {
  return config.models[role];
}

/**
 * Generate a default config file content
 */
export function generateDefaultConfigContent(): string {
  const config: DebateConfigFile = {
    $schema: "https://open-debate.dev/schema/config.json",
    models: {
      default: DEFAULT_MODEL_ID,
      speaker1: null,
      speaker2: null,
      judge: null,
      coach: null,
      topicGenerator: null,
      narrator: null,
      analysis: null,
      promptGenerator: null,
      summary: null,
      nameGenerator: null,
      promptParser: null,
    },
    debate: DEFAULT_DEBATE_SETTINGS,
    output: DEFAULT_OUTPUT_SETTINGS,
  };
  return JSON.stringify(config, null, 2);
}

/**
 * Initialize config file in current directory
 */
export function initConfig(cwd: string = process.cwd()): string {
  const filepath = join(cwd, "debate.config.json");
  if (existsSync(filepath)) {
    throw new Error(`Config file already exists: ${filepath}`);
  }
  const content = generateDefaultConfigContent();
  writeFileSync(filepath, content, "utf-8");
  return filepath;
}

/**
 * Initialize user config in ~/.config/open-debate/
 */
export function initUserConfig(): string {
  if (existsSync(USER_CONFIG_PATH)) {
    throw new Error(`User config already exists: ${USER_CONFIG_PATH}`);
  }
  mkdirSync(USER_CONFIG_DIR, { recursive: true });
  const content = generateDefaultConfigContent();
  writeFileSync(USER_CONFIG_PATH, content, "utf-8");
  return USER_CONFIG_PATH;
}

/**
 * Role descriptions for display
 */
const ROLE_DESCRIPTIONS: Record<LLMRole, string> = {
  speaker1: "Speaker 1 responses",
  speaker2: "Speaker 2 responses",
  judge: "Topic verdicts",
  coach: "Debate coaching",
  topicGenerator: "Topic generation",
  narrator: "Narrator commentary",
  analysis: "Self-analysis",
  promptGenerator: "Prompt generation",
  summary: "Match summary",
  nameGenerator: "Name extraction",
  promptParser: "Prompt parsing",
};

/**
 * Format resolved config for display
 */
export function formatResolvedConfig(config: ResolvedConfig): string {
  const lines: string[] = ["Resolved Configuration:", ""];

  // Find config sources
  const projectPath = findProjectConfigPath();
  const hasUserConfig = existsSync(USER_CONFIG_PATH);

  lines.push("Sources:");
  lines.push(`  Built-in defaults`);
  if (hasUserConfig) {
    lines.push(`  User config: ${USER_CONFIG_PATH}`);
  }
  if (projectPath) {
    lines.push(`  Project config: ${projectPath}`);
  }
  lines.push("");

  lines.push("Models:");
  lines.push(`  ${"default".padEnd(18)} ${config.models.default}`);
  for (const role of Object.keys(ROLE_DESCRIPTIONS) as LLMRole[]) {
    const model = config.models[role];
    const isDefault = model === config.models.default;
    const suffix = isDefault ? " (default)" : "";
    lines.push(`  ${role.padEnd(18)} ${model}${suffix}`);
  }

  lines.push("", "Debate Settings:");
  for (const [key, value] of Object.entries(config.debate)) {
    lines.push(`  ${key.padEnd(18)} ${value}`);
  }

  lines.push("", "Output:");
  for (const [key, value] of Object.entries(config.output)) {
    lines.push(`  ${key.padEnd(18)} ${value}`);
  }

  return lines.join("\n");
}

/**
 * Format models for display (--show-models)
 */
export function formatModels(config: ResolvedConfig): string {
  const lines: string[] = ["Model Configuration:", ""];

  const maxRoleLen = Math.max(...Object.keys(ROLE_DESCRIPTIONS).map((r) => r.length), 7);

  lines.push(`  ${"Role".padEnd(maxRoleLen + 2)} ${"Model".padEnd(40)} Description`);
  lines.push(`  ${"-".repeat(maxRoleLen + 2)} ${"-".repeat(40)} ${"-".repeat(20)}`);

  lines.push(
    `  ${"default".padEnd(maxRoleLen + 2)} ${config.models.default.padEnd(40)} Fallback for all roles`
  );

  for (const role of Object.keys(ROLE_DESCRIPTIONS) as LLMRole[]) {
    const model = config.models[role];
    const desc = ROLE_DESCRIPTIONS[role];
    const isDefault = model === config.models.default;
    const modelDisplay = isDefault ? "(default)" : model;
    lines.push(`  ${role.padEnd(maxRoleLen + 2)} ${modelDisplay.padEnd(40)} ${desc}`);
  }

  return lines.join("\n");
}

/**
 * Validate a config file
 */
export function validateConfig(filepath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!existsSync(filepath)) {
    return { valid: false, errors: [`File not found: ${filepath}`] };
  }

  let config: unknown;
  try {
    const content = readFileSync(filepath, "utf-8");
    config = JSON.parse(content);
  } catch (e) {
    return { valid: false, errors: [`Invalid JSON: ${e}`] };
  }

  if (typeof config !== "object" || config === null) {
    return { valid: false, errors: ["Config must be an object"] };
  }

  const cfg = config as Record<string, unknown>;

  // Check models section
  if (cfg.models !== undefined) {
    if (typeof cfg.models !== "object" || cfg.models === null) {
      errors.push("models must be an object");
    } else {
      const models = cfg.models as Record<string, unknown>;
      if (models.default !== undefined && typeof models.default !== "string") {
        errors.push("models.default must be a string");
      }
      const validRoles = [
        "default",
        "speaker1",
        "speaker2",
        "judge",
        "coach",
        "topicGenerator",
        "narrator",
        "analysis",
        "promptGenerator",
        "summary",
        "nameGenerator",
        "promptParser",
      ];
      for (const key of Object.keys(models)) {
        if (!validRoles.includes(key)) {
          errors.push(`Unknown model role: ${key}`);
        }
        const value = models[key];
        if (value !== null && typeof value !== "string") {
          errors.push(`models.${key} must be a string or null`);
        }
      }
    }
  }

  // Check debate section
  if (cfg.debate !== undefined) {
    if (typeof cfg.debate !== "object" || cfg.debate === null) {
      errors.push("debate must be an object");
    } else {
      const debate = cfg.debate as Record<string, unknown>;
      const numFields = ["turnsPerTopic", "topicsPerDebate", "debatesPerMatch"];
      const boolFields = ["narrate", "selfImprove", "humanCoach"];

      for (const field of numFields) {
        if (debate[field] !== undefined && typeof debate[field] !== "number") {
          errors.push(`debate.${field} must be a number`);
        }
      }
      for (const field of boolFields) {
        if (debate[field] !== undefined && typeof debate[field] !== "boolean") {
          errors.push(`debate.${field} must be a boolean`);
        }
      }
    }
  }

  // Check output section
  if (cfg.output !== undefined) {
    if (typeof cfg.output !== "object" || cfg.output === null) {
      errors.push("output must be an object");
    } else {
      const output = cfg.output as Record<string, unknown>;
      const strFields = ["matchesDir", "agentsDir"];
      for (const field of strFields) {
        if (output[field] !== undefined && typeof output[field] !== "string") {
          errors.push(`output.${field} must be a string`);
        }
      }
      if (output.logsEnabled !== undefined && typeof output.logsEnabled !== "boolean") {
        errors.push("output.logsEnabled must be a boolean");
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
