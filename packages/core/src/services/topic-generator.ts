import { generateObject } from "./llm.js";
import { z } from "zod";
import { getModel, DEFAULT_MODEL_ID } from "./model-provider.js";

const topicsSchema = z.object({
  topics: z.array(z.string()).describe("List of propositional debate topics"),
});

export interface TopicGeneratorOptions {
  speaker1Name: string;
  speaker2Name: string;
  speaker1Persona?: string;  // Full persona description
  speaker2Persona?: string;  // Full persona description
  count: number;
  issueFocus?: string[];
  existingTopics?: string[];
  refinementCommand?: string;
  modelId?: string;
}

export async function generateTopics(
  options: TopicGeneratorOptions
): Promise<string[]> {
  const {
    speaker1Name,
    speaker2Name,
    speaker1Persona,
    speaker2Persona,
    count,
    issueFocus = [],
    existingTopics = [],
    refinementCommand,
    modelId = DEFAULT_MODEL_ID,
  } = options;

  // Use persona if provided, otherwise just the name
  const speaker1Desc = speaker1Persona || speaker1Name;
  const speaker2Desc = speaker2Persona || speaker2Name;

  let prompt = `Generate ${count} propositional debate topics for a debate between two speakers.

Speaker 1: ${speaker1Desc}
Speaker 2: ${speaker2Desc}

Requirements:
- Each topic should be a clear proposition that can be argued for or against
- Topics should be relevant to the speakers' perspectives as described above
- If a speaker is a well-known public figure, also consider their known public positions
- Topics must be NEUTRAL - never mention the speakers by name in the topic text
- Topics should be thought-provoking and allow for substantive debate
- Format as "should" statements (e.g., "Nuclear power should replace coal") or assertions (e.g., "Climate change poses an existential threat to humanity")
- Avoid yes/no topics
- Cover diverse angles and sub-topics`;

  if (issueFocus.length > 0) {
    prompt += `\n\nFocus areas: ${issueFocus.join(", ")}`;
  }

  if (existingTopics.length > 0) {
    prompt += `\n\nExisting topics (generate different ones): ${existingTopics.join("; ")}`;
  }

  if (refinementCommand) {
    prompt += `\n\nAdditional instruction: ${refinementCommand}`;
  }

  const { object } = await generateObject({
    model: getModel(modelId),
    schema: topicsSchema,
    prompt,
  });

  return object.topics;
}

export async function refineTopics(
  existingTopics: string[],
  command: string,
  speaker1Name: string,
  speaker2Name: string,
  modelId: string = DEFAULT_MODEL_ID
): Promise<string[]> {
  const prompt = `You have these existing debate topics for "${speaker1Name}" vs "${speaker2Name}":

${existingTopics.map((t, i) => `${i + 1}. ${t}`).join("\n")}

User request: "${command}"

Based on this request, generate the appropriate topics. If they ask for more topics, add new ones. If they ask to modify or replace topics, do so. Return ALL topics that should be in the final list.`;

  const { object } = await generateObject({
    model: getModel(modelId),
    schema: topicsSchema,
    prompt,
  });

  return object.topics;
}
