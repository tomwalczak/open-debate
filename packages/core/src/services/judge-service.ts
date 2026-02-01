import { generateObject, generateText } from "ai";
import { z } from "zod";
import { getModel, DEFAULT_MODEL_ID } from "./model-provider.js";
import type { AgentConfig } from "../types/agent.js";
import type { Exchange, DebateResult } from "../types/debate.js";
import type { JudgeVerdict, FinalTally, MatchSummary } from "../types/judge.js";

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

  const { object } = await generateObject({
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

  const totalS1 = debates.reduce((sum, d) => sum + d.finalTally.speaker1Wins, 0);
  const totalS2 = debates.reduce((sum, d) => sum + d.finalTally.speaker2Wins, 0);
  const overallWinner = totalS1 > totalS2 ? speaker1Name : totalS2 > totalS1 ? speaker2Name : "Tie";

  const { text } = await generateText({
    model: getModel(modelId),
    prompt: `You are a debate analyst. The reader is about to participate in a 4-hour podcast debate on this topic and needs to quickly understand the landscape of arguments.

${speaker1Name} vs ${speaker2Name}
Final Score: ${speaker1Name} ${totalS1} - ${totalS2} ${speaker2Name}
Winner: ${overallWinner}

${debateSummaries}

Write a self-contained analysis (MAX 600 WORDS) that maps the argument landscape. Someone who didn't watch the debate should be able to follow. The reader needs clarity on the strongest arguments, where the fault lines lie, and what they should investigate further.

Cover:
- Strongest arguments: What were the most compelling arguments made? Be specific about the actual claims and reasoning.
- Load-bearing claims: What are the core propositions each side depends on? State them as clear, falsifiable claims.
- Key tensions: Where do the two sides fundamentally disagree? What would resolve the disagreement?
- Debater weaknesses: What were each speaker's blind spots? Where did they fail to counter arguments or leave claims undefended? What areas could each improve?
- Patterns: Did certain argument types dominate? Were there recurring weaknesses?
- Further investigation: What specific topics should the reader research before their debate?

FORMATTING:
- Write in propositional full sentences. State claims directly.
- No markdown (no **, no ##, no bullet points)
- Plain prose paragraphs with line breaks between sections
- Be specific and analytical, not generic

Use "${speaker1Name}" and "${speaker2Name}" as names throughout.`,
  });

  return { summary: text.trim() };
}
