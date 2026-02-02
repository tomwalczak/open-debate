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

export async function generateIssueArgumentSummary(
  issue: string,
  speaker1Name: string,
  speaker2Name: string,
  debates: DebateResult[],
  modelId: string = DEFAULT_MODEL_ID
): Promise<IssueArgumentSummary> {
  // Collect all exchanges across all debates
  const allExchanges: Array<{ speakerName: string; message: string; topic: string }> = [];
  for (const debate of debates) {
    for (const tr of debate.topicResults) {
      for (const ex of tr.exchanges) {
        allExchanges.push({
          speakerName: ex.speakerName,
          message: ex.message,
          topic: tr.topic,
        });
      }
    }
  }

  // Build condensed transcript grouped by speaker
  const speaker1Messages = allExchanges
    .filter((ex) => ex.speakerName === speaker1Name)
    .map((ex) => `[Topic: ${ex.topic}]\n${ex.message}`)
    .join("\n\n---\n\n");

  const speaker2Messages = allExchanges
    .filter((ex) => ex.speakerName === speaker2Name)
    .map((ex) => `[Topic: ${ex.topic}]\n${ex.message}`)
    .join("\n\n---\n\n");

  const issueArgSchema = z.object({
    speaker1Argument: z.string().describe(`Hierarchical propositional summary of ${speaker1Name}'s best argument on this issue. Use indented bullet points to show logical structure (main claim → supporting reasons → evidence/examples)`),
    speaker2Argument: z.string().describe(`Hierarchical propositional summary of ${speaker2Name}'s best argument on this issue. Use indented bullet points to show logical structure (main claim → supporting reasons → evidence/examples)`),
  });

  const { object } = await generateObject<{ speaker1Argument: string; speaker2Argument: string }>({
    model: getModel(modelId),
    schema: issueArgSchema,
    prompt: `Issue: "${issue}"

${speaker1Name}'s statements:
${speaker1Messages}

${speaker2Name}'s statements:
${speaker2Messages}

For the issue "${issue}", extract the BEST argument each side made. Present each as a hierarchical propositional summary using indented bullet points:
- Main claim at top level
  - Supporting reasons indented below
    - Evidence or examples further indented

Focus on the logical structure. Be concise but capture the key reasoning chain. Use plain English.`,
  });

  return {
    issue,
    speaker1Argument: object.speaker1Argument,
    speaker2Argument: object.speaker2Argument,
  };
}
