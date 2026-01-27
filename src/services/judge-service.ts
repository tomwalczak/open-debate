import { generateObject, generateText } from "ai";
import { z } from "zod";
import { getModel, DEFAULT_MODEL_ID } from "./model-provider.js";
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

  const { text } = await generateText({
    model: getModel(modelId),
    prompt: `You are a debate analyst writing for an intelligent general audience who may not be domain experts on this topic.

${speaker1Name} vs ${speaker2Name}
Final Score: ${speaker1Name} ${totalS1} - ${totalS2} ${speaker2Name}
Winner: ${overallWinner}

${debateSummaries}

Write a self-contained analysis that someone who didn't watch the debate can follow. Your goal is to help readers understand not just who won, but what was actually at stake and what they should take away from seeing both sides argue their best case.

Cover these areas (use your judgment on structure and format - prose, bullets, or a mix as appropriate):

- Context: What was the core question being debated? What real-world stakes or decisions does this connect to?
- Key concepts: If there are technical terms or frameworks that are central to the arguments, briefly explain them in plain language.
- The strongest arguments each side made: Be specific about the actual claims and evidence, not generic debate commentary.
- Blind spots: What did each side miss, concede too easily, or fail to address?
- Why the winner won: What was the decisive factor - evidence quality, moral framing, addressing counterarguments, or something else?
- The takeaway: What should a thoughtful person conclude about this issue after seeing both sides make their case?

Write in clear, jargon-free language. Be analytical and specific. Use "${speaker1Name}" and "${speaker2Name}" as names throughout.`,
  });

  return { summary: text.trim() };
}
