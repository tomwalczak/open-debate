export interface AgentConfig {
  id: string;
  name: string;
  systemPrompt: string;
  modelId: string;
  dirPath: string;
}

export const PROMPT_MAX_LENGTH = 5000;
export const DEFAULT_MODEL_ID = "google:gemini-2.5-flash";
