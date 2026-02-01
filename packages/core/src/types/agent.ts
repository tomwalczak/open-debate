export interface AgentConfig {
  id: string;
  name: string;
  systemPrompt: string;
  modelId: string;
  dirPath: string;
}

export const PROMPT_MAX_LENGTH = 5000;
export const DEFAULT_MODEL_ID = "qwen/qwen3-next-80b-a3b-instruct";
