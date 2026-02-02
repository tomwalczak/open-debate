import { generateObject } from "./llm.js";
import { z } from "zod";
import { getModel } from "./model-provider.js";

const matchConfigSchema = z.object({
  speaker1: z.string().nullable().describe("First speaker - name or persona description, or null if not specified"),
  speaker2: z.string().nullable().describe("Second speaker - name or persona description, or null if not specified"),
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
1. Extract speakers/personas if mentioned. They might be:
   - Named people (e.g., "Alex Epstein", "Al Gore")
   - Personas/viewpoints (e.g., "an atheist", "a Catholic", "climate activist")
   - Descriptions (e.g., "someone who believes in free markets")
   - Set speaker1/speaker2 to null if not clearly specified

2. Extract numeric configuration if mentioned:
   - Number of debates (default: 1)
   - Topics per debate (default: 5)
   - Turns per topic (default: 5)

3. Extract any topic focus mentioned (e.g., "about climate change", "on economic policy")

Examples:
- "5 debates between an atheist and a Catholic" → speaker1: "an atheist", speaker2: "a Catholic", 5 debates
- "Alex Epstein" → speaker1: "Alex Epstein", speaker2: null
- "Run a debate about climate change" → speaker1: null, speaker2: null, topics: ["climate change"]
- "a libertarian vs a socialist" → speaker1: "a libertarian", speaker2: "a socialist"`,
  });

  return object;
}
