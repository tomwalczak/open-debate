import { streamText } from "ai";
import { getModel } from "./model-provider.js";
import type { Exchange } from "../types/debate.js";

export async function narrateExchange(
  exchange: Exchange,
  question: string,
  modelId: string,
  previousExchanges: Exchange[] = [],
  onChunk?: (chunk: string) => void
): Promise<string> {
  const result = await streamText({
    model: getModel(modelId),
    prompt: `Summarize in exactly ONE short sentence (10-15 words max):

"${exchange.message}"

Reply with ONLY: "${exchange.speakerName} [argues/counters/insists/claims] that [key point]."`,
  });

  let fullText = "";
  for await (const chunk of result.textStream) {
    fullText += chunk;
    onChunk?.(chunk);
  }

  return fullText.trim();
}
