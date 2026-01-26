import { DEFAULT_MODEL_ID } from "./openrouter.js";
import type { AgentConfig } from "../types/agent.js";
import { generateId } from "../utils/id.js";

export function generateInitialPrompt(name: string): string {
  return `You are ${name}. You are participating in a public debate.

Be concise.`;
}

export function createJudgeAgent(modelId: string = DEFAULT_MODEL_ID): AgentConfig {
  return {
    id: generateId(),
    name: "Judge",
    systemPrompt: `You are an impartial debate judge. Analyze this debate and declare who won. Penalize verbosity.`,
    modelId,
    dirPath: "",
  };
}
