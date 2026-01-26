import * as fs from "fs";
import * as path from "path";
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

function generateMatchId(): string {
  return `${getRandomElement(ADJECTIVES)}-${getRandomElement(NOUNS)}`;
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

export function createMatch(
  config: MatchConfig,
  forkFromMatchId?: string
): MatchState {
  const matchId = generateMatchId();
  const matchDir = path.join(MATCHES_DIR, matchId);
  const agentsDir = path.join(matchDir, "agents");

  ensureDir(matchDir);
  ensureDir(agentsDir);

  // Create agent directories
  const speaker1Slug = nameToSlug(config.speaker1Name);
  const speaker2Slug = nameToSlug(config.speaker2Name);

  const speaker1Dir = path.join(agentsDir, speaker1Slug);
  const speaker2Dir = path.join(agentsDir, speaker2Slug);

  ensureDir(speaker1Dir);
  ensureDir(speaker2Dir);

  // Get prompts (fork from existing match or use initial)
  let speaker1Prompt: string;
  let speaker2Prompt: string;

  if (forkFromMatchId) {
    const sourceMatch = path.join(MATCHES_DIR, forkFromMatchId, "agents");
    const sourceSpeaker1 = path.join(sourceMatch, speaker1Slug, "prompt.md");
    const sourceSpeaker2 = path.join(sourceMatch, speaker2Slug, "prompt.md");

    speaker1Prompt = fs.existsSync(sourceSpeaker1)
      ? fs.readFileSync(sourceSpeaker1, "utf-8")
      : generateInitialPrompt(config.speaker1Name);
    speaker2Prompt = fs.existsSync(sourceSpeaker2)
      ? fs.readFileSync(sourceSpeaker2, "utf-8")
      : generateInitialPrompt(config.speaker2Name);
  } else {
    speaker1Prompt = generateInitialPrompt(config.speaker1Name);
    speaker2Prompt = generateInitialPrompt(config.speaker2Name);
  }

  // Save initial prompts
  fs.writeFileSync(path.join(speaker1Dir, "prompt.md"), speaker1Prompt);
  fs.writeFileSync(path.join(speaker2Dir, "prompt.md"), speaker2Prompt);

  // Create empty learnings files
  fs.writeFileSync(path.join(speaker1Dir, "learnings.md"), `# ${config.speaker1Name} - Learnings\n\n`);
  fs.writeFileSync(path.join(speaker2Dir, "learnings.md"), `# ${config.speaker2Name} - Learnings\n\n`);

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

export function findLatestMatch(speaker1Name: string, speaker2Name: string): string | null {
  if (!fs.existsSync(MATCHES_DIR)) {
    return null;
  }

  const entries = fs.readdirSync(MATCHES_DIR);
  const speaker1Slug = nameToSlug(speaker1Name);
  const speaker2Slug = nameToSlug(speaker2Name);

  // Find matches that have both speakers
  const matchingDirs: { id: string; mtime: number }[] = [];

  for (const entry of entries) {
    const agentsDir = path.join(MATCHES_DIR, entry, "agents");
    if (fs.existsSync(agentsDir)) {
      const hasS1 = fs.existsSync(path.join(agentsDir, speaker1Slug));
      const hasS2 = fs.existsSync(path.join(agentsDir, speaker2Slug));
      if (hasS1 && hasS2) {
        const stat = fs.statSync(path.join(MATCHES_DIR, entry));
        matchingDirs.push({ id: entry, mtime: stat.mtimeMs });
      }
    }
  }

  if (matchingDirs.length === 0) {
    return null;
  }

  // Return most recent
  matchingDirs.sort((a, b) => b.mtime - a.mtime);
  return matchingDirs[0].id;
}
