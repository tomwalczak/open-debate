import { generateObject } from "ai";
import { z } from "zod";
import { getModel, DEFAULT_MODEL_ID } from "./openrouter.js";

const questionsSchema = z.object({
  questions: z.array(z.string()).describe("List of propositional debate questions"),
});

export interface QuestionGeneratorOptions {
  speaker1Name: string;
  speaker2Name: string;
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
    count,
    issueFocus = [],
    existingQuestions = [],
    refinementCommand,
    modelId = DEFAULT_MODEL_ID,
  } = options;

  let prompt = `Generate ${count} propositional debate questions for a debate between "${speaker1Name}" and "${speaker2Name}".

Requirements:
- Each question should be a clear proposition that can be argued for or against
- Questions should be relevant to the speakers' known perspectives or expertise
- Questions should be thought-provoking and allow for substantive debate
- Format as "should" statements (e.g., "Nuclear power should replace coal") or assertions (e.g., "Climate change poses an existential threat to humanity")
- Avoid yes/no questions
- Cover maximum surface area across different angles and sub-topics, so audiences can assess relative strengths and weaknesses of each side`;

  if (issueFocus.length > 0) {
    prompt += `\n\nFocus areas to emphasize: ${issueFocus.join(", ")}`;
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
