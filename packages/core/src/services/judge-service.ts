import { generateObject, generateText } from "./llm.js";
import { z } from "zod";
import { getModel, DEFAULT_MODEL_ID } from "./model-provider.js";
import type { AgentConfig } from "../types/agent.js";
import type { Exchange, DebateResult } from "../types/debate.js";
import type { JudgeVerdict, FinalTally, MatchSummary, IssueArgumentSummary } from "../types/judge.js";

const verdictSchema = z.object({
  reasoning: z.string().describe("What were the strongest arguments? What logic or evidence was most compelling? (max 100 words)"),
  winnerId: z.string().describe("The ID of the winning speaker"),
});

export async function judgeTopic(
  topic: string,
  exchanges: Exchange[],
  speaker1: AgentConfig,
  speaker2: AgentConfig,
  judge: AgentConfig
): Promise<JudgeVerdict> {
  const transcript = exchanges
    .map((ex) => `[${ex.speakerId}]:\n${ex.message}`)
    .join("\n\n---\n\n");

  const { object } = await generateObject<JudgeVerdict>({
    model: getModel(judge.modelId),
    schema: verdictSchema,
    system: judge.systemPrompt,
    prompt: `Topic: "${topic}"

Speaker IDs: ${speaker1.id}, ${speaker2.id}

Transcript:
${transcript}`,
  });

  return object;
}

export function calculateFinalTally(
  topicVerdicts: JudgeVerdict[],
  speaker1Id: string,
  speaker2Id: string
): FinalTally {
  let speaker1Wins = 0;
  let speaker2Wins = 0;
  let ties = 0;

  for (const verdict of topicVerdicts) {
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

export async function generateMatchSummary(
  speaker1Name: string,
  speaker2Name: string,
  debates: DebateResult[],
  modelId: string = DEFAULT_MODEL_ID
): Promise<MatchSummary> {
  // Build ID -> name mapping from exchanges
  const idToName: Record<string, string> = {};
  for (const debate of debates) {
    for (const tr of debate.topicResults) {
      for (const ex of tr.exchanges) {
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

    const topicSummaries = d.topicResults.map((t, ti) => {
      const winnerName = t.verdict?.winnerId ?
        (d.topicResults[ti]?.exchanges[0]?.speakerId === t.verdict.winnerId ? speaker1Name : speaker2Name) : "Tie";
      const reasoning = t.verdict?.reasoning ? cleanText(t.verdict.reasoning) : "no verdict";
      return `Topic ${ti + 1}: "${t.topic}" → ${winnerName} (${reasoning})`;
    }).join("\n");

    return `Debate ${i + 1}: ${speaker1Name} ${s1Wins} - ${s2Wins} ${speaker2Name} (${winner} wins)\n${topicSummaries}`;
  }).join("\n\n");

  const matchSummarySchema = z.object({
    issues: z.array(z.string()).describe("Short titles for areas where each side had distinct arguments (e.g. 'Should rural areas be subsidized', 'Constitutionality of federal abortion ban')"),
    summary: z.string().describe("3-4 sentences on what arguments made the difference"),
  });

  const { object } = await generateObject<MatchSummary>({
    model: getModel(modelId),
    schema: matchSummarySchema,
    prompt: `You judged a debate. Here are your verdicts for each topic:

${debateSummaries}

List the main areas of disagreement as short titles. Then write 3-4 sentences about what arguments made the difference. Do not mention the speakers by name. Just describe the arguments that were most effective and why.

Use plain, simple English. Short sentences. No jargon. Be concrete and specific, not abstract.`,
  });

  return object;
}
