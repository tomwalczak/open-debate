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

async function generateSeededPrompt(
  name: string,
  seed: string,
  modelId: string
): Promise<string> {
  const { text } = await generateText({
    model: getModel(modelId),
    prompt: `You are creating a system prompt for "${name}" who will participate in public debates.

User's instructions for this debater:
${seed}

Generate a focused system prompt (under 2000 characters) that:
- Embodies ${name}'s perspective and expertise
- Incorporates the user's specific instructions above
- Provides clear debate strategy and approach
- Ends with: "Be concise. Keep your response under 300 words."

Output ONLY the system prompt, nothing else.`,
  });

  return text.trim();
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

  // Get prompts (fork, seed, or default)
  let speaker1Prompt: string;
  let speaker2Prompt: string;

  if (forkFromMatchId) {
    // Fork from existing match - find agent dirs by slug prefix
    const sourceAgentsDir = path.join(MATCHES_DIR, forkFromMatchId, "agents");
    const sourceSpeaker1Dir = findAgentDirBySlug(sourceAgentsDir, speaker1Slug);
    const sourceSpeaker2Dir = findAgentDirBySlug(sourceAgentsDir, speaker2Slug);

    speaker1Prompt = sourceSpeaker1Dir
      ? fs.readFileSync(path.join(sourceSpeaker1Dir, "prompt.md"), "utf-8")
      : generateInitialPrompt(config.speaker1Name);
    speaker2Prompt = sourceSpeaker2Dir
      ? fs.readFileSync(path.join(sourceSpeaker2Dir, "prompt.md"), "utf-8")
      : generateInitialPrompt(config.speaker2Name);
  } else if (config.seed1 || config.seed2) {
    // Generate prompts from seeds
    speaker1Prompt = config.seed1
      ? await generateSeededPrompt(config.speaker1Name, config.seed1, config.modelId)
      : generateInitialPrompt(config.speaker1Name);
    speaker2Prompt = config.seed2
      ? await generateSeededPrompt(config.speaker2Name, config.seed2, config.modelId)
      : generateInitialPrompt(config.speaker2Name);
  } else {
    speaker1Prompt = generateInitialPrompt(config.speaker1Name);
    speaker2Prompt = generateInitialPrompt(config.speaker2Name);
  }

  // Save initial prompts
  fs.writeFileSync(path.join(speaker1Dir, "prompt.md"), speaker1Prompt);
  fs.writeFileSync(path.join(speaker2Dir, "prompt.md"), speaker2Prompt);

  // Create learnings files with user seed at top if provided
  let learnings1 = `# ${config.speaker1Name} - Learnings\n\n`;
  if (config.seed1) {
    learnings1 += `## User Intent\n\n> ${config.seed1}\n\n---\n\n`;
  }
  fs.writeFileSync(path.join(speaker1Dir, "learnings.md"), learnings1);

  let learnings2 = `# ${config.speaker2Name} - Learnings\n\n`;
  if (config.seed2) {
    learnings2 += `## User Intent\n\n> ${config.seed2}\n\n---\n\n`;
  }
  fs.writeFileSync(path.join(speaker2Dir, "learnings.md"), learnings2);

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

