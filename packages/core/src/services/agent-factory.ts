import { DEFAULT_MODEL_ID } from "./model-provider.js";
import type { AgentConfig } from "../types/agent.js";
import { generateId } from "../utils/id.js";

export function generateInitialPrompt(name: string): string {
  return `You are ${name}. You are participating in a public debate.

Be concise. Keep your response under 300 words.`;
}

export const DEFAULT_JUDGE_PROMPT = `You are an impartial debate judge. Analyze the arguments made in this debate and declare who won. Keep your reasoning under 100 words.`;

export function createJudgeAgent(
  modelId: string = DEFAULT_MODEL_ID,
  customPrompt?: string
): AgentConfig {
  return {
    id: generateId(),
    name: "Judge",
    systemPrompt: customPrompt || DEFAULT_JUDGE_PROMPT,
    modelId,
    dirPath: "",
  };
}
