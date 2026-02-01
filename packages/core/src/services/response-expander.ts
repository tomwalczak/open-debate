import { generateText } from "ai";
import { getModel } from "./model-provider.js";
import type { Exchange } from "../types/debate.js";

/**
 * Process human input for debate - use judgment to expand OR use as-is.
 *
 * CRITICAL: Preserve the user's exact phrasings and tone of voice.
 * Don't rewrite polished responses - just fix typos/punctuation if needed.
 * Only expand bullet points/rough notes into full sentences.
 */
export async function processHumanInput(
  humanInput: string,
  speakerName: string,
  question: string,
  previousExchanges: Exchange[],
  roundNumber: number,
  modelId: string
): Promise<string> {
  const context = previousExchanges.slice(-2).map(ex =>
    `${ex.speakerName}: ${ex.message}`
  ).join("\n\n");

  const { text } = await generateText({
    model: getModel(modelId),
    prompt: `You are the AI debate partner for a human debating as "${speakerName}".

The human has written their response. Your job is to help them - but with MINIMAL changes.

## CRITICAL RULES
1. **Preserve their voice**: Keep the user's exact phrasings and tone. Don't rewrite sentences in a different way.
2. **Use judgment**:
   - If their response is already well-written -> use it AS-IS (only fix obvious typos or missing punctuation)
   - If their response is bullet points or rough notes -> expand into full sentences while keeping their exact words/phrases
3. **Never add arguments**: Don't introduce points the human didn't make
4. **Keep it under 300 words**

## Context
Question: ${question}
Round: ${roundNumber}
${context ? `Recent exchanges:\n${context}` : ""}

## Human's Input
${humanInput}

## Your Task
Output the final debate response. If their input is already polished, return it with minimal edits. If it's rough notes, expand it while preserving their voice. Output ONLY the response:`,
  });

  return text.trim();
}
