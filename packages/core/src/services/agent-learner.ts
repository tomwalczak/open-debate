import { generateText } from "ai";
import { getModel } from "./model-provider.js";
import { saveAgentPrompt, appendAgentLearnings, readAgentLearnings, generatePromptFromLearnings } from "./match-storage.js";
import type { AgentConfig } from "../types/agent.js";
import type { TopicResult } from "../types/debate.js";

function formatDate(): string {
  return new Date().toISOString().split("T")[0];
}

function generateLogEntry(
  agent: AgentConfig,
  opponent: AgentConfig,
  results: TopicResult[],
  humanFeedback?: string
): string {
  const date = formatDate();

  const resultsText = results
    .map((tr, i) => {
      if (!tr.verdict) return `- Topic ${i + 1}: "${tr.topic.slice(0, 40)}..." - NO VERDICT`;

      const won = tr.verdict.winnerId === agent.id;
      const outcome = won ? "WON" : "LOST";
      return `- Topic ${i + 1}: "${tr.topic.slice(0, 40)}..." - ${outcome} - Judge: "${tr.verdict.reasoning.slice(0, 100)}..."`;
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
  results: TopicResult[],
  modelId: string
): Promise<{ worked: string; improve: string }> {
  const transcript = results
    .map((tr, i) => {
      // Group exchanges by turn
      const turnsMap = new Map<number, typeof tr.exchanges>();
      for (const ex of tr.exchanges) {
        const turn = turnsMap.get(ex.turnNumber) || [];
        turn.push(ex);
        turnsMap.set(ex.turnNumber, turn);
      }

      // Build turn-by-turn transcript with clear XML structure
      const turnsText = Array.from(turnsMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([turnNum, exchanges]) => {
          const exchangesText = exchanges
            .map((ex) => {
              const role = ex.speakerId === agent.id ? "me" : "opponent";
              return `    <speaker role="${role}" name="${ex.speakerName}">
${ex.message}
    </speaker>`;
            })
            .join("\n\n");
          return `  <turn number="${turnNum}">
${exchangesText}
  </turn>`;
        })
        .join("\n\n");

      // Build verdict section
      const won = tr.verdict?.winnerId === agent.id;
      const verdictText = tr.verdict
        ? `  <verdict>
    <outcome>${won ? "I WON" : "I LOST"}</outcome>
    <winner>${won ? agent.name : opponent.name}</winner>
    <reasoning>${tr.verdict.reasoning}</reasoning>
  </verdict>`
        : `  <verdict>
    <outcome>NO VERDICT</outcome>
  </verdict>`;

      return `<topic number="${i + 1}">
  <subject>${tr.topic}</subject>

  <transcript>
${turnsText}
  </transcript>

${verdictText}
</topic>`;
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
  debateResults: TopicResult[],
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
    .map((tr, i) => {
      if (!tr.verdict) return `- Topic ${i + 1}: "${tr.topic.slice(0, 40)}..." - NO VERDICT`;

      const won = tr.verdict.winnerId === agent.id;
      const outcome = won ? "WON" : "LOST";
      return `- Topic ${i + 1}: "${tr.topic.slice(0, 40)}..." - ${outcome} - Judge: "${tr.verdict.reasoning.slice(0, 100)}..."`;
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
