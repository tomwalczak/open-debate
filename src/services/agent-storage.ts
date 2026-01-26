import * as fs from "fs";
import * as path from "path";
import type { AgentConfig } from "../types/agent.js";
import { generateId } from "../utils/id.js";
import { generateInitialPrompt } from "./agent-factory.js";

const AGENTS_DIR = "agents";

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

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function generateAgentSlug(name: string): string {
  const baseSlug = nameToSlug(name);
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const adjective = getRandomElement(ADJECTIVES);
  const noun = getRandomElement(NOUNS);
  return `${baseSlug}-${month}-${day}-${adjective}-${noun}`;
}

function ensureAgentsDir(): void {
  if (!fs.existsSync(AGENTS_DIR)) {
    fs.mkdirSync(AGENTS_DIR, { recursive: true });
  }
}

function getAgentDir(slug: string): string {
  return path.join(AGENTS_DIR, slug);
}

function getPromptPath(dirPath: string): string {
  return path.join(dirPath, "prompt.md");
}

function getLogPath(dirPath: string): string {
  return path.join(dirPath, "log.md");
}

function findExistingAgentDir(baseName: string): string | null {
  const baseSlug = nameToSlug(baseName);

  if (!fs.existsSync(AGENTS_DIR)) {
    return null;
  }

  const entries = fs.readdirSync(AGENTS_DIR);

  // Look for directories that start with the base slug
  for (const entry of entries) {
    if (entry.startsWith(baseSlug + "-") || entry === baseSlug) {
      const fullPath = path.join(AGENTS_DIR, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        return fullPath;
      }
    }
  }

  return null;
}

export function createAgent(
  name: string,
  modelId: string,
  fork: boolean = false
): AgentConfig {
  ensureAgentsDir();

  // If fork mode, try to copy prompt from existing agent
  let systemPrompt: string;
  if (fork) {
    const existingDir = findExistingAgentDir(name);
    if (existingDir) {
      const promptPath = getPromptPath(existingDir);
      systemPrompt = fs.existsSync(promptPath)
        ? fs.readFileSync(promptPath, "utf-8")
        : generateInitialPrompt(name);
    } else {
      // No existing agent to fork from, use initial prompt
      systemPrompt = generateInitialPrompt(name);
    }
  } else {
    // Fresh agent, always use initial prompt
    systemPrompt = generateInitialPrompt(name);
  }

  // Always create new agent directory
  const slug = generateAgentSlug(name);
  const dirPath = getAgentDir(slug);

  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(getPromptPath(dirPath), systemPrompt);

  // Create empty log file
  fs.writeFileSync(getLogPath(dirPath), `# ${name} - Debate Log\n\n`);

  return {
    id: generateId(),
    name,
    systemPrompt,
    modelId,
    dirPath,
  };
}

export function saveAgentPrompt(agent: AgentConfig): void {
  const promptPath = getPromptPath(agent.dirPath);
  fs.writeFileSync(promptPath, agent.systemPrompt);
}

export function appendAgentLog(agent: AgentConfig, entry: string): void {
  const logPath = getLogPath(agent.dirPath);
  fs.appendFileSync(logPath, entry + "\n\n");
}

export function readAgentLog(agent: AgentConfig): string {
  const logPath = getLogPath(agent.dirPath);
  if (!fs.existsSync(logPath)) {
    return "";
  }
  return fs.readFileSync(logPath, "utf-8");
}
