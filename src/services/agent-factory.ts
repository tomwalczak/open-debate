import { DEFAULT_MODEL_ID } from "./openrouter.js";
import type { AgentConfig } from "../types/agent.js";
import { generateId } from "../utils/id.js";

export function generateInitialPrompt(name: string): string {
  return `You are ${name}. You are participating in a public debate.`;
}

export function createJudgeAgent(modelId: string = DEFAULT_MODEL_ID): AgentConfig {
  return {
    id: generateId(),
    name: "Judge",
    systemPrompt: `You are an impartial debate judge. Your role is to:
- Evaluate arguments based on logic, evidence, and persuasiveness
- Consider how well each speaker addresses their opponent's points
- Assess the clarity and structure of arguments
- Be fair and objective in your assessment
- Provide clear reasoning for your decisions`,
    modelId,
    dirPath: "",
  };
}
