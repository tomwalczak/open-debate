import { generateText } from "ai";
import { getModel } from "./model-provider.js";
import { saveAgentPrompt, appendAgentLearnings, readAgentLearnings, generatePromptFromLearnings } from "./match-storage.js";
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
  opponent: AgentConfig,
  results: QuestionResult[],
  modelId: string
): Promise<{ worked: string; improve: string }> {
  const transcript = results
    .map((qr, i) => {
      // Group exchanges by round
      const roundsMap = new Map<number, typeof qr.exchanges>();
      for (const ex of qr.exchanges) {
        const round = roundsMap.get(ex.roundNumber) || [];
        round.push(ex);
        roundsMap.set(ex.roundNumber, round);
      }

      // Build round-by-round transcript with clear XML structure
      const roundsText = Array.from(roundsMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([roundNum, exchanges]) => {
          const exchangesText = exchanges
            .map((ex) => {
              const role = ex.speakerId === agent.id ? "me" : "opponent";
              return `    <speaker role="${role}" name="${ex.speakerName}">
${ex.message}
    </speaker>`;
            })
            .join("\n\n");
          return `  <round number="${roundNum}">
${exchangesText}
  </round>`;
        })
        .join("\n\n");

      // Build verdict section
      const won = qr.verdict?.winnerId === agent.id;
      const verdictText = qr.verdict
        ? `  <verdict>
    <outcome>${won ? "I WON" : "I LOST"}</outcome>
    <winner>${won ? agent.name : opponent.name}</winner>
    <reasoning>${qr.verdict.reasoning}</reasoning>
  </verdict>`
        : `  <verdict>
    <outcome>NO VERDICT</outcome>
  </verdict>`;

      return `<question number="${i + 1}">
  <topic>${qr.question}</topic>

  <transcript>
${roundsText}
  </transcript>

${verdictText}
</question>`;
    })
    .join("\n\n");

  const { text } = await generateText({
    model: getModel(modelId),
    prompt: `You are ${agent.name}. Analyze your performance in this debate against ${opponent.name}.

Study the full transcript below. Pay attention to:
- What arguments worked when you WON
- What opponent arguments beat you when you LOST
- What you failed to counter effectively

<debate-transcript>
${transcript}
</debate-transcript>

Based on this analysis, provide a brief self-analysis in exactly this format (one line each):
Worked: [what strategies worked well - be specific about which arguments/tactics]
Improve: [what you should do differently - mention specific opponent arguments to counter]

Be specific and concise (under 150 characters each).`,
  });

  const workedMatch = text.match(/Worked:\s*(.+)/i);
  const improveMatch = text.match(/Improve:\s*(.+)/i);

  return {
    worked: workedMatch?.[1]?.trim() || "Unclear from analysis",
    improve: improveMatch?.[1]?.trim() || "Unclear from analysis",
  };
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
  const analysis = await generateSelfAnalysis(agent, opponent, debateResults, modelId);

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
    // Pass current prompt so LLM can improve it (not generate from scratch)
    const newPrompt = await generatePromptFromLearnings(agent.name, fullLearnings, modelId, agent.systemPrompt);
    agent.systemPrompt = newPrompt;
    saveAgentPrompt(agent);
  }
}
