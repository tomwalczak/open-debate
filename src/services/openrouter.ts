import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModelV1 } from "ai";
import { DEFAULT_MODEL_ID } from "../types/agent.js";

let openrouterInstance: ReturnType<typeof createOpenRouter> | null = null;

function getOpenRouter() {
  if (!openrouterInstance) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error("Error: OPENROUTER_API_KEY environment variable is required");
      console.error("Set it in your .env file or export it in your shell");
      process.exit(1);
    }
    openrouterInstance = createOpenRouter({ apiKey });
  }
  return openrouterInstance;
}

export function getModel(modelId: string = DEFAULT_MODEL_ID): LanguageModelV1 {
  return getOpenRouter().chat(modelId);
}

export { DEFAULT_MODEL_ID };
