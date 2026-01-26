import { generateText } from "ai";
import { getModel } from "./openrouter.js";
import { saveAgentPrompt, appendAgentLearnings, readAgentLearnings } from "./agent-storage.js";
import { PROMPT_MAX_LENGTH } from "../types/agent.js";
import type { AgentConfig } from "../types/agent.js";
import type { QuestionResult } from "../types/debate.js";

function formatDate(): string {
  return new Date().toISOString().split("T")[0];
}

function generateLogEntry(
  agent: AgentConfig,
  opponent: AgentConfig,
  results: QuestionResult[],
  humanFeedback?: string
): string {
  const date = formatDate();

  const resultsText = results
    .map((qr, i) => {
      if (!qr.verdict) return `- Q${i + 1}: "${qr.question.slice(0, 40)}..." - NO VERDICT`;

      const won = qr.verdict.winnerId === agent.id;
      const outcome = won ? "WON" : "LOST";
      return `- Q${i + 1}: "${qr.question.slice(0, 40)}..." - ${outcome} - Judge: "${qr.verdict.reasoning.slice(0, 100)}..."`;
    })
    .join("\n");

  let entry = `## ${date} vs ${opponent.name}

### Results
${resultsText}

### Analysis
- Worked: [To be filled by self-analysis]
- Improve: [To be filled by self-analysis]`;

  if (humanFeedback) {
    entry += `

### Human Feedback
"${humanFeedback}"`;
  }

  return entry;
}

async function generateSelfAnalysis(
  agent: AgentConfig,
  results: QuestionResult[],
  modelId: string
): Promise<{ worked: string; improve: string }> {
  const transcript = results
    .map((qr, i) => {
      const agentExchanges = qr.exchanges
        .filter((ex) => ex.speakerId === agent.id)
        .map((ex) => ex.message)
        .join("\n");
      const won = qr.verdict?.winnerId === agent.id;
      const verdict = qr.verdict
        ? `${won ? "I won" : "I lost"} - ${qr.verdict.reasoning}`
        : "No verdict";
      return `Q${i + 1}: ${qr.question}\nMy arguments:\n${agentExchanges}\nVerdict: ${verdict}`;
    })
    .join("\n\n---\n\n");

  const { text } = await generateText({
    model: getModel(modelId),
    prompt: `You are ${agent.name}. Analyze your performance in this debate.

${transcript}

Provide a brief self-analysis in exactly this format (one line each):
Worked: [what strategies worked well]
Improve: [what you should do differently next time]

Be specific and concise (under 100 characters each).`,
  });

  const workedMatch = text.match(/Worked:\s*(.+)/i);
  const improveMatch = text.match(/Improve:\s*(.+)/i);

  return {
    worked: workedMatch?.[1]?.trim() || "Unclear from analysis",
    improve: improveMatch?.[1]?.trim() || "Unclear from analysis",
  };
}

async function generateUpdatedPrompt(
  agent: AgentConfig,
  log: string,
  modelId: string,
  retryCount: number = 0,
  overageChars?: number
): Promise<string> {
  const overageNote = overageChars
    ? `\n\nYour previous attempt was ${overageChars} characters over the limit. Be more concise this time.`
    : "";

  const { text } = await generateText({
    model: getModel(modelId),
    prompt: `You are ${agent.name}. Review your debate log and update your system prompt.

Current prompt:
${agent.systemPrompt}

Your debate log:
${log}

Generate an improved system prompt that:
- Incorporates lessons from your wins and losses
- Addresses weaknesses identified by judges
- Integrates any human feedback
- Maintains your core perspective and expertise
- Is under ${PROMPT_MAX_LENGTH} characters
${overageNote}

Output ONLY the new system prompt, nothing else.`,
  });

  const newPrompt = text.trim();

  if (newPrompt.length > PROMPT_MAX_LENGTH) {
    if (retryCount >= 3) {
      // After 3 retries, truncate
      return newPrompt.slice(0, PROMPT_MAX_LENGTH - 100) + "\n\n[Truncated to fit limit]";
    }
    const overage = newPrompt.length - PROMPT_MAX_LENGTH;
    return generateUpdatedPrompt(agent, log, modelId, retryCount + 1, overage);
  }

  return newPrompt;
}

export async function updateAgentAfterDebate(
  agent: AgentConfig,
  debateResults: QuestionResult[],
  opponent: AgentConfig,
  modelId: string,
  humanFeedback?: string,
  selfImprove: boolean = false
): Promise<void> {
  // Skip learning for judge agents (they have no dirPath)
  if (!agent.dirPath) {
    return;
  }

  // Generate self-analysis
  const analysis = await generateSelfAnalysis(agent, debateResults, modelId);

  // Create learnings entry with analysis
  const date = formatDate();
  const resultsText = debateResults
    .map((qr, i) => {
      if (!qr.verdict) return `- Q${i + 1}: "${qr.question.slice(0, 40)}..." - NO VERDICT`;

      const won = qr.verdict.winnerId === agent.id;
      const outcome = won ? "WON" : "LOST";
      return `- Q${i + 1}: "${qr.question.slice(0, 40)}..." - ${outcome} - Judge: "${qr.verdict.reasoning.slice(0, 100)}..."`;
    })
    .join("\n");

  let entry = `## ${date} vs ${opponent.name}

### Results
${resultsText}

### Analysis
- Worked: ${analysis.worked}
- Improve: ${analysis.improve}`;

  if (humanFeedback) {
    entry += `

### Human Feedback
"${humanFeedback}"`;
  }

  // Always append learnings
  appendAgentLearnings(agent, entry);

  // Only update prompt if self-improve is enabled
  if (selfImprove) {
    const fullLearnings = readAgentLearnings(agent);
    const newPrompt = await generateUpdatedPrompt(agent, fullLearnings, modelId);
    agent.systemPrompt = newPrompt;
    saveAgentPrompt(agent);
  }
}
