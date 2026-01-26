import { generateObject } from "ai";
import { z } from "zod";
import { getModel, DEFAULT_MODEL_ID } from "./openrouter.js";

const questionsSchema = z.object({
  questions: z.array(z.string()).describe("List of propositional debate questions"),
});

export interface QuestionGeneratorOptions {
  speaker1Name: string;
  speaker2Name: string;
  speaker1Persona?: string;  // Full persona description
  speaker2Persona?: string;  // Full persona description
  count: number;
  issueFocus?: string[];
  existingQuestions?: string[];
  refinementCommand?: string;
  modelId?: string;
}

export async function generateQuestions(
  options: QuestionGeneratorOptions
): Promise<string[]> {
  const {
    speaker1Name,
    speaker2Name,
    speaker1Persona,
    speaker2Persona,
    count,
    issueFocus = [],
    existingQuestions = [],
    refinementCommand,
    modelId = DEFAULT_MODEL_ID,
  } = options;

  // Use persona if provided, otherwise just the name
  const speaker1Desc = speaker1Persona || speaker1Name;
  const speaker2Desc = speaker2Persona || speaker2Name;

  let prompt = `Generate ${count} propositional debate questions for a debate between two speakers.

Speaker 1: ${speaker1Desc}
Speaker 2: ${speaker2Desc}

Requirements:
- Each question should be a clear proposition that can be argued for or against
- Questions should be relevant to the speakers' perspectives as described above
- If a speaker is a well-known public figure, also consider their known public positions
- Questions must be NEUTRAL - never mention the speakers by name in the question text
- Questions should be thought-provoking and allow for substantive debate
- Format as "should" statements (e.g., "Nuclear power should replace coal") or assertions (e.g., "Climate change poses an existential threat to humanity")
- Avoid yes/no questions
- Cover diverse angles and sub-topics`;

  if (issueFocus.length > 0) {
    prompt += `\n\nFocus areas: ${issueFocus.join(", ")}`;
  }

  if (existingQuestions.length > 0) {
    prompt += `\n\nExisting questions (generate different ones): ${existingQuestions.join("; ")}`;
  }

  if (refinementCommand) {
    prompt += `\n\nAdditional instruction: ${refinementCommand}`;
  }

  const { object } = await generateObject({
    model: getModel(modelId),
    schema: questionsSchema,
    prompt,
  });

  return object.questions;
}

export async function refineQuestions(
  existingQuestions: string[],
  command: string,
  speaker1Name: string,
  speaker2Name: string,
  modelId: string = DEFAULT_MODEL_ID
): Promise<string[]> {
  const prompt = `You have these existing debate questions for "${speaker1Name}" vs "${speaker2Name}":

${existingQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

User request: "${command}"

Based on this request, generate the appropriate questions. If they ask for more questions, add new ones. If they ask to modify or replace questions, do so. Return ALL questions that should be in the final list.`;

  const { object } = await generateObject({
    model: getModel(modelId),
    schema: questionsSchema,
    prompt,
  });

  return object.questions;
}
