import * as fs from "fs";
import * as path from "path";
import { generateText } from "ai";
import { getModel } from "./openrouter.js";
import type { AgentConfig } from "../types/agent.js";
import type { MatchConfig, MatchState, DebateResult, QuestionResult } from "../types/debate.js";
import type { FinalTally } from "../types/judge.js";
import { generateId } from "../utils/id.js";
import { generateInitialPrompt, createJudgeAgent } from "./agent-factory.js";

const MATCHES_DIR = "matches";

const ADJECTIVES = [
  "swift", "brave", "calm", "bold", "keen", "wise", "warm", "cool", "fair", "kind",
  "quick", "sharp", "bright", "clear", "deep", "fresh", "grand", "light", "pure", "rich",
  "soft", "strong", "true", "vivid", "wild", "agile", "clever", "eager", "fierce", "gentle",
  "happy", "jolly", "lively", "merry", "noble", "proud", "quiet", "serene", "tender", "witty"
];

const NOUNS = [
  "falcon", "phoenix", "tiger", "eagle", "wolf", "bear", "lion", "hawk", "raven", "fox",
  "otter", "badger", "heron", "crane", "swift", "finch", "cedar", "maple", "birch", "aspen",
  "river", "brook", "storm", "frost", "flame", "spark", "coral", "pearl", "amber", "jade",
  "summit", "ridge", "canyon", "meadow", "grove", "harbor", "reef", "dune", "glacier", "aurora"
];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateShort(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const year = String(now.getFullYear()).slice(-2);
  return `${month}-${day}-${year}`;
}

function generateMatchId(speaker1Name: string, speaker2Name: string): string {
  const date = formatDate();
  const s1 = nameToSlug(speaker1Name).split("-")[0]; // First word only
  const s2 = nameToSlug(speaker2Name).split("-")[0];
  const adjNoun = `${getRandomElement(ADJECTIVES)}-${getRandomElement(NOUNS)}`;
  return `${date}-${s1}-vs-${s2}-${adjNoun}`;
}

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

import { PROMPT_MAX_LENGTH } from "../types/agent.js";

/**
 * Generates a debate prompt from learnings.md content.
 * This is the single source of truth for prompt generation.
 *
 * Handles:
 * - Fresh agents (no learnings) → basic prompt
 * - Seeded agents (Strategic Brief only) → prompt from brief
 * - Evolved agents (Strategic Brief + debate history) → refined prompt
 * - Forked agents (copied learnings) → prompt from inherited history
 */
export async function generatePromptFromLearnings(
  name: string,
  learnings: string,
  modelId: string,
  retryCount: number = 0,
  overageChars?: number
): Promise<string> {
  // Check if there's meaningful content beyond just the header
  const hasContent = learnings.includes("<strategic-brief>") ||
                     learnings.includes("## ") && !learnings.match(/^# .+ - Learnings\s*$/m);

  if (!hasContent || learnings.trim().split("\n").length <= 2) {
    // No meaningful learnings - generate basic prompt
    return generateInitialPrompt(name);
  }

  const overageNote = overageChars
    ? `\n\nYour previous attempt was ${overageChars} characters over the limit. Be more concise this time.`
    : "";

  // Check for Strategic Brief
  const hasStrategicBrief = learnings.includes("<strategic-brief>");

  const strategicBriefInstruction = hasStrategicBrief
    ? `
IMPORTANT: This agent has a <strategic-brief> section. This contains the operator's core instructions
for how this debater should approach arguments. Treat the Strategic Brief as the PRIMARY directive -
all learned behaviors from debate history should REFINE and SUPPORT the Strategic Brief, never override it.
`
    : "";

  const { text } = await generateText({
    model: getModel(modelId),
    prompt: `You are creating a system prompt for "${name}" who will participate in public debates.

Here is this agent's learnings file (containing their Strategic Brief and/or debate history):

${learnings}
${strategicBriefInstruction}
Generate a focused system prompt (under ${PROMPT_MAX_LENGTH} characters) that:
- Embodies ${name}'s perspective and expertise
- If a Strategic Brief exists: treat it as the core directive that shapes all strategy
- If debate history exists: incorporate lessons from wins/losses to refine tactics
- Provides clear, actionable debate strategy
- Ends with: "Be concise. Keep your response under 300 words."
${overageNote}
Output ONLY the system prompt, nothing else.`,
  });

  const newPrompt = text.trim();

  if (newPrompt.length > PROMPT_MAX_LENGTH) {
    if (retryCount >= 3) {
      return newPrompt.slice(0, PROMPT_MAX_LENGTH - 100) + "\n\n[Truncated to fit limit]";
    }
    const overage = newPrompt.length - PROMPT_MAX_LENGTH;
    return generatePromptFromLearnings(name, learnings, modelId, retryCount + 1, overage);
  }

  return newPrompt;
}

function formatStrategicBrief(seed: string): string {
  return `## Strategic Brief

<strategic-brief priority="high">
${seed}
</strategic-brief>

---

`;
}

function replaceStrategicBrief(learnings: string, name: string, newSeed: string): string {
  // Remove existing Strategic Brief section if present
  const briefRegex = /## Strategic Brief\s*\n\s*<strategic-brief[^>]*>[\s\S]*?<\/strategic-brief>\s*\n---\s*\n*/;

  if (briefRegex.test(learnings)) {
    // Replace existing Strategic Brief
    return learnings.replace(briefRegex, formatStrategicBrief(newSeed));
  } else {
    // Insert Strategic Brief after the header
    const headerRegex = /^(# .+ - Learnings\s*\n\s*)/;
    if (headerRegex.test(learnings)) {
      return learnings.replace(headerRegex, `$1\n${formatStrategicBrief(newSeed)}`);
    } else {
      // No header found, prepend everything
      return `# ${name} - Learnings\n\n${formatStrategicBrief(newSeed)}${learnings}`;
    }
  }
}

export async function createMatch(
  config: MatchConfig,
  forkFromMatchId?: string
): Promise<MatchState> {
  const matchId = generateMatchId(config.speaker1Name, config.speaker2Name);
  const matchDir = path.join(MATCHES_DIR, matchId);
  const agentsDir = path.join(matchDir, "agents");
  const dateShort = formatDateShort();

  ensureDir(matchDir);
  ensureDir(agentsDir);

  // Create agent directories with match name and date
  const speaker1Slug = nameToSlug(config.speaker1Name);
  const speaker2Slug = nameToSlug(config.speaker2Name);
  // Extract adj-noun from end of matchId (e.g., "2026-01-26-alex-vs-al-swift-hawk" -> "swift-hawk")
  const parts = matchId.split("-");
  const matchSuffix = parts.slice(-2).join("-");

  const speaker1Dir = path.join(agentsDir, `${speaker1Slug}-${dateShort}-${matchSuffix}`);
  const speaker2Dir = path.join(agentsDir, `${speaker2Slug}-${dateShort}-${matchSuffix}`);

  ensureDir(speaker1Dir);
  ensureDir(speaker2Dir);

  // Build learnings files (the source of truth)
  let learnings1 = `# ${config.speaker1Name} - Learnings\n\n`;
  let learnings2 = `# ${config.speaker2Name} - Learnings\n\n`;

  if (forkFromMatchId) {
    // Fork: copy learnings.md from source match (preserves Strategic Brief + history)
    const sourceAgentsDir = path.join(MATCHES_DIR, forkFromMatchId, "agents");
    const sourceSpeaker1Dir = findAgentDirBySlug(sourceAgentsDir, speaker1Slug);
    const sourceSpeaker2Dir = findAgentDirBySlug(sourceAgentsDir, speaker2Slug);

    if (sourceSpeaker1Dir) {
      const sourceLearnings = path.join(sourceSpeaker1Dir, "learnings.md");
      if (fs.existsSync(sourceLearnings)) {
        learnings1 = fs.readFileSync(sourceLearnings, "utf-8");
      }
    }
    if (sourceSpeaker2Dir) {
      const sourceLearnings = path.join(sourceSpeaker2Dir, "learnings.md");
      if (fs.existsSync(sourceLearnings)) {
        learnings2 = fs.readFileSync(sourceLearnings, "utf-8");
      }
    }

    // If seed provided alongside fork, update/replace the Strategic Brief
    if (config.seed1) {
      learnings1 = replaceStrategicBrief(learnings1, config.speaker1Name, config.seed1);
    }
    if (config.seed2) {
      learnings2 = replaceStrategicBrief(learnings2, config.speaker2Name, config.seed2);
    }
  } else {
    // New match: add Strategic Brief if seeds provided
    if (config.seed1) {
      learnings1 += formatStrategicBrief(config.seed1);
    }
    if (config.seed2) {
      learnings2 += formatStrategicBrief(config.seed2);
    }
  }

  // Save learnings files
  fs.writeFileSync(path.join(speaker1Dir, "learnings.md"), learnings1);
  fs.writeFileSync(path.join(speaker2Dir, "learnings.md"), learnings2);

  // Generate prompts from learnings (single source of truth)
  const speaker1Prompt = await generatePromptFromLearnings(
    config.speaker1Name,
    learnings1,
    config.modelId
  );
  const speaker2Prompt = await generatePromptFromLearnings(
    config.speaker2Name,
    learnings2,
    config.modelId
  );

  // Save generated prompts (as cache/reference)
  fs.writeFileSync(path.join(speaker1Dir, "prompt.md"), speaker1Prompt);
  fs.writeFileSync(path.join(speaker2Dir, "prompt.md"), speaker2Prompt);

  // Create agent configs
  const firstSpeaker: AgentConfig = {
    id: generateId(),
    name: config.speaker1Name,
    systemPrompt: speaker1Prompt,
    modelId: config.modelId,
    dirPath: speaker1Dir,
  };

  const secondSpeaker: AgentConfig = {
    id: generateId(),
    name: config.speaker2Name,
    systemPrompt: speaker2Prompt,
    modelId: config.modelId,
    dirPath: speaker2Dir,
  };

  // Save match config
  const matchState: MatchState = {
    id: matchId,
    dirPath: matchDir,
    config,
    currentDebateNumber: 0,
    completedDebates: [],
    firstSpeaker,
    secondSpeaker,
  };

  fs.writeFileSync(
    path.join(matchDir, "config.json"),
    JSON.stringify(config, null, 2)
  );

  return matchState;
}

function findAgentDirBySlug(agentsDir: string, slug: string): string | null {
  if (!fs.existsSync(agentsDir)) return null;
  const entries = fs.readdirSync(agentsDir);
  const match = entries.find((e) => e.startsWith(slug + "-"));
  return match ? path.join(agentsDir, match) : null;
}

export function saveDebateResult(
  match: MatchState,
  debateNumber: number,
  questionResults: QuestionResult[],
  finalTally: FinalTally
): void {
  const result: DebateResult = {
    debateNumber,
    questionResults,
    finalTally,
    completedAt: new Date().toISOString(),
  };

  // Save JSON
  fs.writeFileSync(
    path.join(match.dirPath, `debate-${debateNumber}.json`),
    JSON.stringify(result, null, 2)
  );

  // Save transcript
  const transcript = generateTranscript(match, debateNumber, questionResults, finalTally);
  fs.writeFileSync(
    path.join(match.dirPath, `debate-${debateNumber}-transcript.md`),
    transcript
  );
}

function generateTranscript(
  match: MatchState,
  debateNumber: number,
  questionResults: QuestionResult[],
  finalTally: FinalTally
): string {
  let md = `# ${match.config.speaker1Name} vs ${match.config.speaker2Name}\n`;
  md += `## Debate ${debateNumber} of ${match.config.totalDebates}\n\n`;
  md += `**Match**: ${match.id}\n`;
  md += `**Date**: ${new Date().toISOString()}\n`;
  md += `**Rounds per Question**: ${match.config.roundsPerQuestion}\n\n`;

  if (match.config.issueFocus && match.config.issueFocus.length > 0) {
    md += `**Issue Focus**: ${match.config.issueFocus.join(", ")}\n\n`;
  }

  md += `---\n\n`;

  questionResults.forEach((qr, qIndex) => {
    md += `## Question ${qIndex + 1}: ${qr.question}\n\n`;

    qr.exchanges.forEach((ex) => {
      md += `### ${ex.speakerName} (Round ${ex.roundNumber})\n\n`;
      md += `${ex.message}\n\n`;
    });

    if (qr.verdict) {
      const winnerName = qr.verdict.winnerId === match.firstSpeaker.id
        ? match.firstSpeaker.name
        : match.secondSpeaker.name;
      md += `### Judge Verdict\n\n`;
      md += `**Winner**: ${winnerName}\n\n`;
      md += `**Reasoning**: ${qr.verdict.reasoning}\n\n`;
    }

    md += `---\n\n`;
  });

  md += `## Final Tally\n\n`;
  md += `- **${match.firstSpeaker.name}**: ${finalTally.speaker1Wins} wins\n`;
  md += `- **${match.secondSpeaker.name}**: ${finalTally.speaker2Wins} wins\n`;
  if (finalTally.ties > 0) {
    md += `- **Ties**: ${finalTally.ties}\n`;
  }
  md += `\n`;

  return md;
}

export function appendAgentLearnings(agent: AgentConfig, entry: string): void {
  const learningsPath = path.join(agent.dirPath, "learnings.md");
  fs.appendFileSync(learningsPath, entry + "\n\n");
}

export function readAgentLearnings(agent: AgentConfig): string {
  const learningsPath = path.join(agent.dirPath, "learnings.md");
  if (!fs.existsSync(learningsPath)) {
    return "";
  }
  return fs.readFileSync(learningsPath, "utf-8");
}

export function saveAgentPrompt(agent: AgentConfig): void {
  const promptPath = path.join(agent.dirPath, "prompt.md");
  fs.writeFileSync(promptPath, agent.systemPrompt);
}

