import { generateObject } from "ai";
import { z } from "zod";
import { getModel, DEFAULT_MODEL_ID } from "./openrouter.js";
import type { AgentConfig } from "../types/agent.js";
import type { Exchange, DebateResult } from "../types/debate.js";
import type { JudgeVerdict, FinalTally, MatchSummary } from "../types/judge.js";

const verdictSchema = z.object({
  reasoning: z.string().describe("Brief explanation for the verdict (max 100 words)"),
  winnerId: z.string().describe("The ID of the winning speaker"),
});

export async function judgeQuestion(
  question: string,
  exchanges: Exchange[],
  speaker1: AgentConfig,
  speaker2: AgentConfig,
  judge: AgentConfig
): Promise<JudgeVerdict> {
  const transcript = exchanges
    .map((ex) => `[${ex.speakerId}]:\n${ex.message}`)
    .join("\n\n---\n\n");

  const { object } = await generateObject({
    model: getModel(judge.modelId),
    schema: verdictSchema,
    system: judge.systemPrompt,
    prompt: `Question: "${question}"

Speaker IDs: ${speaker1.id}, ${speaker2.id}

Transcript:
${transcript}`,
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

const matchSummarySchema = z.object({
  trajectory: z.string().describe("2-3 sentences on how the match unfolded - momentum shifts, comebacks, patterns"),
  keyArguments: z.string().describe("2-3 most powerful arguments that swung verdicts, with speaker attribution"),
  verdict: z.string().describe("1 sentence final assessment of why the winner won"),
});

export async function generateMatchSummary(
  speaker1Name: string,
  speaker2Name: string,
  debates: DebateResult[],
  modelId: string = DEFAULT_MODEL_ID
): Promise<MatchSummary> {
  // Build ID -> name mapping from exchanges
  const idToName: Record<string, string> = {};
  for (const debate of debates) {
    for (const qr of debate.questionResults) {
      for (const ex of qr.exchanges) {
        idToName[ex.speakerId] = ex.speakerName;
      }
    }
  }

  // Helper to replace IDs with names in text
  const cleanText = (text: string): string => {
    let cleaned = text;
    for (const [id, name] of Object.entries(idToName)) {
      cleaned = cleaned.replace(new RegExp(id, 'g'), name);
    }
    return cleaned;
  };

  // Build a condensed view of the match for the judge
  const debateSummaries = debates.map((d, i) => {
    const s1Wins = d.finalTally.speaker1Wins;
    const s2Wins = d.finalTally.speaker2Wins;
    const winner = s1Wins > s2Wins ? speaker1Name : s2Wins > s1Wins ? speaker2Name : "Tie";

    const questionSummaries = d.questionResults.map((q, qi) => {
      const winnerName = q.verdict?.winnerId ?
        (d.questionResults[qi]?.exchanges[0]?.speakerId === q.verdict.winnerId ? speaker1Name : speaker2Name) : "Tie";
      const reasoning = q.verdict?.reasoning ? cleanText(q.verdict.reasoning) : "no verdict";
      return `Q${qi + 1}: "${q.question}" → ${winnerName} (${reasoning})`;
    }).join("\n");

    return `Debate ${i + 1}: ${speaker1Name} ${s1Wins} - ${s2Wins} ${speaker2Name} (${winner} wins)\n${questionSummaries}`;
  }).join("\n\n");

  const totalS1 = debates.reduce((sum, d) => sum + d.finalTally.speaker1Wins, 0);
  const totalS2 = debates.reduce((sum, d) => sum + d.finalTally.speaker2Wins, 0);
  const overallWinner = totalS1 > totalS2 ? speaker1Name : totalS2 > totalS1 ? speaker2Name : "Tie";

  const { object } = await generateObject({
    model: getModel(modelId),
    schema: matchSummarySchema,
    prompt: `You are a debate analyst. Analyze this ${debates.length}-debate match and provide a high-signal summary.

SPEAKERS (use these names ONLY - ignore any IDs in the data):
- Speaker 1: ${speaker1Name}
- Speaker 2: ${speaker2Name}

Final Score: ${speaker1Name} ${totalS1} - ${totalS2} ${speaker2Name}
Winner: ${overallWinner}

${debateSummaries}

Focus on:
1. Trajectory: How did momentum shift? Any comebacks or dominant runs?
2. Key Arguments: Which specific arguments were most effective? Quote or paraphrase them.
3. Verdict: In one sentence, why did the winner win?

IMPORTANT: Always refer to speakers as "${speaker1Name}" and "${speaker2Name}" - never use IDs or other identifiers.`,
  });

  return object;
}
