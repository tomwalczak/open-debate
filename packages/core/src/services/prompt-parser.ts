import { generateObject } from "./llm.js";
import { z } from "zod";
import { getModel } from "./model-provider.js";

const matchConfigSchema = z.object({
  speaker1: z.string().describe("First speaker - name, persona, or viewpoint (e.g., 'Proponent', 'Climate Activist', 'Alex Epstein')"),
  speaker2: z.string().describe("Second speaker - name, persona, or viewpoint (e.g., 'Opponent', 'Climate Skeptic', 'Al Gore')"),
  totalDebates: z.number().min(1).max(100).default(1).describe("Number of debates to run"),
  topicsPerDebate: z.number().min(1).max(50).default(5).describe("Topics per debate"),
  turnsPerTopic: z.number().min(1).max(20).default(5).describe("Turns per topic"),
  issueFocus: z.array(z.string()).optional().describe("Specific topics to focus on"),
});

export type ParsedMatchConfig = z.infer<typeof matchConfigSchema>;

/**
 * Parses user input into match configuration.
 * Returns null for speaker fields if they can't be determined.
 */
export async function parseMatchPrompt(
  prompt: string,
  modelId: string
): Promise<ParsedMatchConfig> {
  const { object } = await generateObject({
    model: getModel(modelId),
    schema: matchConfigSchema,
    prompt: `Parse this user input into a debate match configuration.

User input: "${prompt}"

Instructions:
1. ALWAYS provide speaker1 and speaker2. Extract them if mentioned, otherwise generate appropriate defaults:
   - Named people (e.g., "Alex Epstein", "Al Gore") → use as-is
   - Personas/viewpoints (e.g., "an atheist", "a Catholic") → use as-is
   - If only a topic is given (e.g., "should drugs be legal"), create appropriate opposing viewpoints
     like "Legalization Advocate" vs "Prohibition Advocate", or "Proponent" vs "Opponent"
   - Make speaker names descriptive of their likely position on the topic

2. Extract numeric configuration if mentioned:
   - Number of debates (default: 1)
   - Topics per debate (default: 5)
   - Turns per topic (default: 5)

3. Extract any topic focus mentioned (e.g., "about climate change", "on economic policy")

Examples:
- "5 debates between an atheist and a Catholic" → speaker1: "an atheist", speaker2: "a Catholic", 5 debates
- "should all drugs be legalized" → speaker1: "Legalization Advocate", speaker2: "Prohibition Advocate"
- "The US should allow fully autonomous cars" → speaker1: "Autonomous Vehicle Proponent", speaker2: "Autonomous Vehicle Skeptic"
- "climate change policy" → speaker1: "Climate Action Advocate", speaker2: "Climate Policy Skeptic"
- "a libertarian vs a socialist" → speaker1: "a libertarian", speaker2: "a socialist"`,
  });

  return object;
}
