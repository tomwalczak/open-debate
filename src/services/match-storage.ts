import * as fs from "fs";
import * as path from "path";
import { generateText } from "ai";
import { getModel } from "./model-provider.js";
import type { AgentConfig } from "../types/agent.js";
import type { MatchConfig, MatchState, DebateResult, QuestionResult } from "../types/debate.js";
import type { FinalTally } from "../types/judge.js";
import { generateId } from "../utils/id.js";
import { generateInitialPrompt, DEFAULT_JUDGE_PROMPT } from "./agent-factory.js";

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

function getNextSequenceNumber(date: string): string {
  if (!fs.existsSync(MATCHES_DIR)) {
    return "00";
  }

  const entries = fs.readdirSync(MATCHES_DIR);
  // Find matches starting with this date and extract sequence numbers
  const todayMatches = entries.filter(e => e.startsWith(date + "-"));
  const seqNumbers = todayMatches
    .map(e => {
      // Format: 2026-01-26-00-alex-vs-al-...
      const parts = e.split("-");
      if (parts.length >= 4) {
        const seq = parseInt(parts[3], 10);
        return isNaN(seq) ? -1 : seq;
      }
      return -1;
    })
    .filter(n => n >= 0);

  const nextSeq = seqNumbers.length > 0 ? Math.max(...seqNumbers) + 1 : 0;
  return nextSeq.toString().padStart(2, "0");
}

function generateMatchId(speaker1Name: string, speaker2Name: string): string {
  const date = formatDate();
  const seq = getNextSequenceNumber(date);
  const s1 = nameToSlug(speaker1Name).split("-")[0]; // First word only
  const s2 = nameToSlug(speaker2Name).split("-")[0];
  const adjNoun = `${getRandomElement(ADJECTIVES)}-${getRandomElement(NOUNS)}`;
  return `${date}-${seq}-${s1}-vs-${s2}-${adjNoun}`;
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
  const hasStrategicBrief = learnings.includes("<strategic-brief");
  const hasDebateHistory = /^## \d{4}-\d{2}-\d{2}/m.test(learnings); // Has dated debate sections
  const hasContent = hasStrategicBrief || hasDebateHistory;

  if (!hasContent) {
    // No meaningful learnings - generate basic prompt
    return generateInitialPrompt(name);
  }

  const overageNote = overageChars
    ? `\n\nYour previous attempt was ${overageChars} characters over the limit. Be more concise this time.`
    : "";

  const strategicBriefInstruction = hasStrategicBrief
    ? `
# Strategic Brief Priority

The learnings file contains a <strategic-brief> section with the operator's core instructions.
Treat the Strategic Brief as the PRIMARY directive - all learned behaviors from debate history
should REFINE and SUPPORT the Strategic Brief, never override it.
`
    : "";

  const { text } = await generateText({
    model: getModel(modelId),
    prompt: `# Task

Generate a system prompt for "${name}" who will participate in public debates.

# Requirements

The generated prompt must:
- Be under ${PROMPT_MAX_LENGTH} characters
- Embody ${name}'s perspective and expertise
- Provide clear, actionable debate strategy
- If a Strategic Brief exists: treat it as the core directive that shapes all strategy
- If debate history exists: incorporate lessons from wins/losses to refine tactics
- End with: "Be concise. Keep your response under 300 words."
${strategicBriefInstruction}
# Output Format

Output ONLY the system prompt text. No commentary, no markdown, no quotes.
${overageNote}
# Agent's Learnings File

Study this carefully - it contains the Strategic Brief (core directives) and/or debate history (what worked/failed):

${learnings}

Now generate the system prompt for ${name}:`,
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

/**
 * Generates a judge prompt from optional seed instructions.
 * Uses the same Strategic Brief pattern as debaters.
 */
export async function generateJudgePrompt(
  seed: string | undefined,
  modelId: string
): Promise<string> {
  if (!seed) {
    return DEFAULT_JUDGE_PROMPT;
  }

  // Create learnings with Strategic Brief
  const learnings = `# Judge - Criteria\n\n` + formatStrategicBrief(seed);

  // Generate prompt using same pattern as debaters
  return generatePromptFromLearnings("Judge", learnings, modelId);
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

export interface CreateMatchResult {
  match: MatchState;
  judgePrompt: string;
}

export async function createMatch(
  config: MatchConfig,
  forkFromMatchId?: string
): Promise<CreateMatchResult> {
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

  // Use persona for prompt generation, fall back to name if no persona
  const persona1 = config.speaker1Persona || config.speaker1Name;
  const persona2 = config.speaker2Persona || config.speaker2Name;

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
  // Use full persona for prompt generation if available
  const speaker1Prompt = await generatePromptFromLearnings(
    persona1,
    learnings1,
    config.modelId
  );
  const speaker2Prompt = await generatePromptFromLearnings(
    persona2,
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

  // Create judge directory and save prompt
  const judgeDir = path.join(matchDir, "judge");
  ensureDir(judgeDir);

  // Create logs directory
  const logsDir = path.join(matchDir, "logs");
  ensureDir(logsDir);

  // Log match creation
  logMatchEvent(matchDir, "MATCH_CREATED", "Match initialized", {
    matchId,
    speaker1: config.speaker1Name,
    speaker2: config.speaker2Name,
    totalDebates: config.totalDebates,
    questionsPerDebate: config.questionsPerDebate,
    modelId: config.modelId
  });

  const judgePrompt = await generateJudgePrompt(config.judgeSeed, config.modelId);
  fs.writeFileSync(path.join(judgeDir, "prompt.md"), judgePrompt);

  // Save seed instructions if provided
  if (config.judgeSeed) {
    fs.writeFileSync(
      path.join(judgeDir, "seed.md"),
      `# Judge Seed Instructions\n\n${config.judgeSeed}`
    );
  }

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

  return { match: matchState, judgePrompt };
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

/**
 * Logs an event to the match's logs directory.
 * Creates timestamped log entries for tracking match progress.
 */
export function logMatchEvent(
  matchDirPath: string,
  eventType: string,
  message: string,
  data?: Record<string, unknown>
): void {
  const logsDir = path.join(matchDirPath, "logs");
  ensureDir(logsDir);

  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    eventType,
    message,
    ...(data && { data })
  };

  // Append to events.jsonl (JSON Lines format)
  const logFile = path.join(logsDir, "events.jsonl");
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n");
}

/**
 * Logs an error to the match's logs directory.
 * Captures full error details including stack trace.
 */
export function logMatchError(
  matchDirPath: string,
  error: Error | unknown,
  context: string,
  additionalData?: Record<string, unknown>
): void {
  const logsDir = path.join(matchDirPath, "logs");
  ensureDir(logsDir);

  const timestamp = new Date().toISOString();
  const errorObj = error instanceof Error ? error : new Error(String(error));

  const errorEntry = {
    timestamp,
    context,
    error: {
      name: errorObj.name,
      message: errorObj.message,
      stack: errorObj.stack
    },
    ...(additionalData && { data: additionalData })
  };

  // Append to errors.jsonl
  const errorFile = path.join(logsDir, "errors.jsonl");
  fs.appendFileSync(errorFile, JSON.stringify(errorEntry) + "\n");

  // Also log to events
  logMatchEvent(matchDirPath, "ERROR", `${context}: ${errorObj.message}`, additionalData);
}

/**
 * Gets the logs directory path for a match.
 */
export function getLogsDir(matchDirPath: string): string {
  return path.join(matchDirPath, "logs");
}

export function saveAgentPrompt(agent: AgentConfig): void {
  const promptPath = path.join(agent.dirPath, "prompt.md");
  fs.writeFileSync(promptPath, agent.systemPrompt);
}

/**
 * Load an existing match for resuming from where it left off.
 * Returns the match state with completed debates loaded.
 */
export async function loadMatchForResume(
  matchId: string
): Promise<{ match: MatchState; judgePrompt: string; startFromDebate: number } | null> {
  const matchDir = path.join(MATCHES_DIR, matchId);

  if (!fs.existsSync(matchDir)) {
    return null;
  }

  // Load config
  const configPath = path.join(matchDir, "config.json");
  if (!fs.existsSync(configPath)) {
    return null;
  }
  const config: MatchConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  // Find agent directories
  const agentsDir = path.join(matchDir, "agents");
  const speaker1Slug = nameToSlug(config.speaker1Name);
  const speaker2Slug = nameToSlug(config.speaker2Name);
  const speaker1Dir = findAgentDirBySlug(agentsDir, speaker1Slug);
  const speaker2Dir = findAgentDirBySlug(agentsDir, speaker2Slug);

  if (!speaker1Dir || !speaker2Dir) {
    return null;
  }

  // Load prompts
  const speaker1Prompt = fs.readFileSync(path.join(speaker1Dir, "prompt.md"), "utf-8");
  const speaker2Prompt = fs.readFileSync(path.join(speaker2Dir, "prompt.md"), "utf-8");

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

  // Load judge prompt
  const judgeDir = path.join(matchDir, "judge");
  const judgePrompt = fs.existsSync(path.join(judgeDir, "prompt.md"))
    ? fs.readFileSync(path.join(judgeDir, "prompt.md"), "utf-8")
    : DEFAULT_JUDGE_PROMPT;

  // Count completed debates by checking debate-N.json files
  let completedDebates: DebateResult[] = [];
  for (let i = 1; i <= config.totalDebates; i++) {
    const debatePath = path.join(matchDir, `debate-${i}.json`);
    if (fs.existsSync(debatePath)) {
      const debateData = JSON.parse(fs.readFileSync(debatePath, "utf-8"));
      completedDebates.push(debateData);
    } else {
      break; // Stop at first missing debate
    }
  }

  const startFromDebate = completedDebates.length + 1;

  const match: MatchState = {
    id: matchId,
    dirPath: matchDir,
    config,
    currentDebateNumber: completedDebates.length,
    completedDebates,
    firstSpeaker,
    secondSpeaker,
  };

  logMatchEvent(matchDir, "MATCH_RESUMED", `Resuming from debate ${startFromDebate}`, {
    matchId,
    completedDebates: completedDebates.length,
    totalDebates: config.totalDebates
  });

  return { match, judgePrompt, startFromDebate };
}

