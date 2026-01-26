import { generateObject } from "ai";
import { z } from "zod";
import { getModel, DEFAULT_MODEL_ID } from "./openrouter.js";
import type { AgentConfig } from "../types/agent.js";
import type { Exchange } from "../types/debate.js";
import type { JudgeVerdict, FinalTally } from "../types/judge.js";

const verdictSchema = z.object({
  winnerId: z.string().describe("The ID of the winning speaker"),
  winnerName: z.string().describe("The name of the winning speaker"),
  reason: z.string().describe("Brief explanation for the verdict (max 100 words)"),
});

export async function judgeQuestion(
  question: string,
  exchanges: Exchange[],
  speaker1: AgentConfig,
  speaker2: AgentConfig,
  judge: AgentConfig
): Promise<JudgeVerdict> {
  const transcript = exchanges
    .map((ex) => `${ex.speakerName} (Round ${ex.roundNumber}):\n${ex.message}`)
    .join("\n\n---\n\n");

  const { object } = await generateObject({
    model: getModel(judge.modelId),
    schema: verdictSchema,
    system: judge.systemPrompt,
    prompt: `Evaluate this debate round on the question: "${question}"

Speaker 1: ${speaker1.name} (ID: ${speaker1.id})
Speaker 2: ${speaker2.name} (ID: ${speaker2.id})

Transcript:
${transcript}

Determine which speaker made the more compelling case. Consider:
- Quality of arguments and evidence
- How well they addressed their opponent's points
- Clarity and persuasiveness

Provide your verdict with the winner's ID, name, and a brief reason (max 100 words).`,
  });

  return object;
}

export function calculateFinalTally(
  questionVerdicts: JudgeVerdict[],
  speaker1Id: string,
  speaker2Id: string
): FinalTally {
  let speaker1Wins = 0;
  let speaker2Wins = 0;
  let ties = 0;

  for (const verdict of questionVerdicts) {
    if (verdict.winnerId === speaker1Id) {
      speaker1Wins++;
    } else if (verdict.winnerId === speaker2Id) {
      speaker2Wins++;
    } else {
      ties++;
    }
  }

  return { speaker1Wins, speaker2Wins, ties };
}
