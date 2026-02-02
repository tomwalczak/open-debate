import { generateObject, generateText } from "./llm.js";
import { z } from "zod";
import { getModel, DEFAULT_MODEL_ID } from "./model-provider.js";
import type { AgentConfig } from "../types/agent.js";
import type { Exchange, DebateResult } from "../types/debate.js";
import type { JudgeVerdict, FinalTally, MatchSummary, IssueArgumentSummary, ArgumentPoint } from "../types/judge.js";

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

  const matchSummarySchema = z.object({
    issues: z.array(z.string()).describe("Short titles for areas where each side had distinct arguments (e.g. 'Should rural areas be subsidized', 'Constitutionality of federal abortion ban')"),
    summary: z.string().describe("3-4 sentences on what arguments made the difference"),
  });

  const { object } = await generateObject({
    model: getModel(modelId),
    schema: matchSummarySchema,
    prompt: `You judged a debate. Here are your verdicts for each topic:

${debateSummaries}

List the main areas of disagreement as short titles. Then write 3-4 sentences about what arguments made the difference. Do not mention the speakers by name. Just describe the arguments that were most effective and why.

Use plain, simple English. Short sentences. No jargon. Be concrete and specific, not abstract.`,
  });

  return object;
}

// Default model for argument analysis - GPT 5.2 with reasoning
const ARGUMENT_ANALYSIS_MODEL = "openai:gpt-5.2";

// Generic hierarchical argument structure (up to 3 levels)
const argumentPointSchema = z.object({
  claim: z.string().describe("A proposition, argument, or piece of evidence"),
  support: z.array(z.object({
    claim: z.string().describe("A supporting proposition, reason, or evidence"),
    support: z.array(z.object({
      claim: z.string().describe("Further support - a sub-reason, example, or detail"),
    })).optional(),
  })).optional(),
});

export async function generateIssueArgumentSummary(
  issue: string,
  speaker1Name: string,
  speaker2Name: string,
  debates: DebateResult[],
  modelId: string = ARGUMENT_ANALYSIS_MODEL
): Promise<IssueArgumentSummary> {
  // Use only the last debate
  const lastDebate = debates[debates.length - 1];
  if (!lastDebate) {
    return {
      issue,
      speaker1Argument: { claim: "No debate data available" },
      speaker2Argument: { claim: "No debate data available" },
    };
  }

  // Collect exchanges from the last debate only
  const exchanges: Array<{ speakerName: string; message: string; topic: string }> = [];
  for (const tr of lastDebate.topicResults) {
    for (const ex of tr.exchanges) {
      exchanges.push({
        speakerName: ex.speakerName,
        message: ex.message,
        topic: tr.topic,
      });
    }
  }

  // Build condensed transcript grouped by speaker
  const speaker1Messages = exchanges
    .filter((ex) => ex.speakerName === speaker1Name)
    .map((ex) => `[Topic: ${ex.topic}]\n${ex.message}`)
    .join("\n\n---\n\n");

  const speaker2Messages = exchanges
    .filter((ex) => ex.speakerName === speaker2Name)
    .map((ex) => `[Topic: ${ex.topic}]\n${ex.message}`)
    .join("\n\n---\n\n");

  const issueArgSchema = z.object({
    speaker1Argument: argumentPointSchema.describe(`${speaker1Name}'s best argument on this issue as a hierarchical structure`),
    speaker2Argument: argumentPointSchema.describe(`${speaker2Name}'s best argument on this issue as a hierarchical structure`),
  });

  const { object } = await generateObject({
    model: getModel(modelId),
    schema: issueArgSchema,
    prompt: `Issue: "${issue}"

${speaker1Name}'s statements:
${speaker1Messages}

${speaker2Name}'s statements:
${speaker2Messages}

For the issue "${issue}", extract the BEST argument each side made.

Return a hierarchical structure where each node has:
- "claim": a proposition, argument, or piece of evidence
- "support" (optional): sub-claims that back it up

Use 1-3 levels of depth as needed. A claim might be supported by reasons, evidence, examples, or sub-arguments—use whatever fits the content. Be concise. Use plain English.`,
    providerOptions: {
      openai: { reasoningEffort: "medium" },
    },
  });

  return {
    issue,
    speaker1Argument: object.speaker1Argument,
    speaker2Argument: object.speaker2Argument,
  };
}
