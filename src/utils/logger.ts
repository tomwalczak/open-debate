import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import type { DebateState, QuestionResult } from "../types/index.js";

const LOGS_DIR = "logs";

export function ensureLogsDir(debateId: string): string {
  const debateDir = join(LOGS_DIR, debateId);
  if (!existsSync(debateDir)) {
    mkdirSync(debateDir, { recursive: true });
  }
  return debateDir;
}

export function writeDebateJson(state: DebateState): void {
  const dir = ensureLogsDir(state.id);
  const data = {
    id: state.id,
    config: state.config,
    firstSpeaker: {
      id: state.firstSpeaker.id,
      name: state.firstSpeaker.name,
      dirPath: state.firstSpeaker.dirPath,
    },
    secondSpeaker: {
      id: state.secondSpeaker.id,
      name: state.secondSpeaker.name,
      dirPath: state.secondSpeaker.dirPath,
    },
    questionResults: state.questionResults,
    finalTally: state.finalTally,
    humanFeedback: state.humanFeedback,
    completedAt: new Date().toISOString(),
  };
  writeFileSync(join(dir, "debate.json"), JSON.stringify(data, null, 2));
}

export function writeTranscriptMd(state: DebateState): void {
  const dir = ensureLogsDir(state.id);

  let md = `# Debate: ${state.firstSpeaker.name} vs ${state.secondSpeaker.name}\n\n`;
  md += `**Date**: ${new Date().toISOString()}\n`;
  md += `**Rounds per Question**: ${state.config.roundsPerQuestion}\n\n`;

  if (state.config.issueFocus && state.config.issueFocus.length > 0) {
    md += `**Issue Focus**: ${state.config.issueFocus.join(", ")}\n\n`;
  }

  md += `---\n\n`;

  state.questionResults.forEach((qr: QuestionResult, qIndex: number) => {
    md += `## Question ${qIndex + 1}: ${qr.question}\n\n`;

    qr.exchanges.forEach((ex) => {
      md += `### ${ex.speakerName} (Round ${ex.roundNumber})\n\n`;
      md += `${ex.message}\n\n`;
    });

    if (qr.verdict) {
      const winnerName = qr.verdict.winnerId === state.firstSpeaker.id
        ? state.firstSpeaker.name
        : state.secondSpeaker.name;
      md += `### Judge Verdict\n\n`;
      md += `**Winner**: ${winnerName}\n\n`;
      md += `**Reasoning**: ${qr.verdict.reasoning}\n\n`;
    }

    md += `---\n\n`;
  });

  if (state.finalTally) {
    md += `## Final Tally\n\n`;
    md += `- **${state.firstSpeaker.name}**: ${state.finalTally.speaker1Wins} wins\n`;
    md += `- **${state.secondSpeaker.name}**: ${state.finalTally.speaker2Wins} wins\n`;
    if (state.finalTally.ties > 0) {
      md += `- **Ties**: ${state.finalTally.ties}\n`;
    }
    md += `\n`;
  }

  if (state.humanFeedback) {
    md += `## Human Coach Feedback\n\n${state.humanFeedback}\n\n`;
  }

  writeFileSync(join(dir, "transcript.md"), md);
}

export function saveDebateLogs(state: DebateState): void {
  writeDebateJson(state);
  writeTranscriptMd(state);
}
