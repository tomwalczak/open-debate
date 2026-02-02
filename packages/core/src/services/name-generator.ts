import { generateObject } from "./llm.js";
import { z } from "zod";
import { getModel } from "./model-provider.js";

const MAX_DISPLAY_NAME_LENGTH = 25;

const namesSchema = z.object({
  name1: z.string().describe("Display name for speaker 1"),
  name2: z.string().describe("Display name for speaker 2"),
});

function isShortEnough(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_DISPLAY_NAME_LENGTH) return true;
  // Check if it looks like a real name (2-3 capitalized words)
  const namePattern = /^[A-Z][a-z]+ [A-Z][a-z]+( [A-Z][a-z]+)?$/;
  return namePattern.test(trimmed) && trimmed.length <= 30;
}

function truncateName(name: string): string {
  const cleaned = name.trim().replace(/^["']|["']$/g, "");
  if (cleaned.length > MAX_DISPLAY_NAME_LENGTH) {
    return cleaned.slice(0, MAX_DISPLAY_NAME_LENGTH - 3) + "...";
  }
  return cleaned;
}

/**
 * Generates short display names for both speakers in a single LLM call.
 * This ensures consistency in naming style between the two speakers.
 * If inputs are already short (like "Al Gore"), returns them as-is.
 */
export async function generateDisplayNames(
  persona1: string,
  persona2: string,
  modelId: string
): Promise<[string, string]> {
  const trimmed1 = persona1.trim();
  const trimmed2 = persona2.trim();

  const short1 = isShortEnough(trimmed1);
  const short2 = isShortEnough(trimmed2);

  // Both already short - return as-is
  if (short1 && short2) {
    return [trimmed1, trimmed2];
  }

  // Generate names for both (even if one is short, for consistency)
  const { object } = await generateObject({
    model: getModel(modelId),
    schema: namesSchema,
    prompt: `Extract or create short display names (under 20 characters each) for these two debate personas.

Speaker 1: "${trimmed1}"
Speaker 2: "${trimmed2}"

Instructions:
1. FIRST: Look for any person's name mentioned (e.g., "You are Alex Epstein" → "Alex Epstein")
2. If a name is found, use it exactly as written
3. Only if NO name is mentioned, create a brief descriptive label (e.g., "Climate Advocate", "Tech Optimist")
4. Names should be distinct and easy to tell apart`,
  });

  return [truncateName(object.name1), truncateName(object.name2)];
}

/**
 * @deprecated Use generateDisplayNames for both speakers together
 */
export async function generateDisplayName(
  personaOrName: string,
  modelId: string
): Promise<string> {
  const [name] = await generateDisplayNames(personaOrName, personaOrName, modelId);
  return name;
}
