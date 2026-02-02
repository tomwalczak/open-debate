#!/usr/bin/env node
import "dotenv/config";

// Handle --help before any other imports to avoid API key check
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(`
Open Debate - AI Debate Arena

Usage:
  npx debate                          Interactive wizard mode
  npx debate [options]                Command-line automation mode

Options:
  --prompt <text>           Natural language prompt (e.g., "5 debates between an atheist and a Catholic")
  --speaker1 <name>         First speaker name or persona
  --speaker2 <name>         Second speaker name or persona
  --seed1 <instructions>    Instructions for generating speaker1's initial prompt
  --seed2 <instructions>    Instructions for generating speaker2's initial prompt
  --turns <number>          Turns per topic (default: 5)
  --topics <number>         Number of debate topics (default: 5)
  --issues <topics>         Comma-separated focus topics
  --human-coach             Enable human coaching
  --no-human-coach          Disable human coaching
  --human-side <side>       Which side human plays ("speaker1" or "speaker2")
  --debates <number>        Number of debates to run
  --autopilot               Run debates without human intervention
  --fork-from <match-id>    Fork agents from specific match directory (use evolved prompts)
  --resume <match-id>       Resume an incomplete match from where it left off
  --self-improve            Enable agent self-improvement (default: on)
  --no-self-improve         Disable agent self-improvement
  --narrate                 Enable real-time narrator commentary (off by default)
  --no-narrate              Disable narrator commentary (default)
  --judge-seed <text>       Instructions for judge persona

Model Options:
  --model <id>              Default model for all roles
  --speaker1-model <id>     Model for speaker 1
  --speaker2-model <id>     Model for speaker 2
  --judge-model <id>        Model for judging
  --coach-model <id>        Model for debate coaching
  --topic-model <id>        Model for topic generation
  --narrator-model <id>     Model for narrator
  --analysis-model <id>     Model for self-analysis
  --prompt-model <id>       Model for prompt generation
  --summary-model <id>      Model for match summary
  --name-model <id>         Model for name extraction
  --parser-model <id>       Model for prompt parsing

Config Commands:
  --init-config             Create debate.config.json in current directory
  --show-config             Show resolved configuration (all sources merged)
  --show-models             Show model for each role
  --validate-config         Validate config file
  --help                    Show this help message

Model Formats:
  Direct APIs:
    openai:gpt-5.2                      GPT-5.2 via OpenAI
    google:gemini-2.5-flash             Gemini 2.5 Flash via Google
    google:gemini-3-pro-preview         Gemini 3 Pro via Google
    anthropic:claude-sonnet-4-5-20251101 Claude Sonnet 4.5 via Anthropic
    anthropic:claude-opus-4-5-20251101  Claude Opus 4.5 via Anthropic

  Via OpenRouter (default):
    qwen/qwen3-next-80b-a3b-instruct    Qwen 3 80B (default)
    openrouter:openai/gpt-5.2           GPT-5.2 via OpenRouter
    openrouter:anthropic/claude-opus-4.5 Opus via OpenRouter

Config Files (priority order):
  1. CLI flags (highest)
  2. ./debate.config.json (project)
  3. ~/.config/open-debate/config.json (user)
  4. Built-in defaults (lowest)

Environment:
  OPENROUTER_API_KEY              For OpenRouter models (default)
  OPENAI_API_KEY                  For openai:* models
  ANTHROPIC_API_KEY               For anthropic:* models
  GOOGLE_GENERATIVE_AI_API_KEY    For google:* models

Examples:
  npx debate
  npx debate --prompt "5 debates between an atheist and a Catholic about morality"
  npx debate --speaker1 "Alex Epstein" --speaker2 "Al Gore" --issues "climate,energy"
  npx debate --speaker1 "Elon Musk" --speaker2 "Bill Gates" --debates 5 --autopilot
  npx debate --speaker1-model "anthropic:claude-opus-4-5-20251101" --speaker2-model "openai:gpt-5.2"

Keys during debate:
  1-9         Switch between active topic tabs
  Ctrl+C      Exit
`);
  process.exit(0);
}

// Handle config commands before other imports
import {
  loadConfig,
  initConfig,
  formatResolvedConfig,
  formatModels,
  validateConfig,
  findProjectConfigPath,
} from "@open-debate/core";
import type { CLIModelOverrides } from "@open-debate/core";

// Quick parse of model overrides for config commands
function parseModelOverrides(rawArgs: string[]): CLIModelOverrides {
  const overrides: CLIModelOverrides = {};
  const flagMap: Record<string, keyof CLIModelOverrides> = {
    "--model": "model",
    "--speaker1-model": "speaker1Model",
    "--speaker2-model": "speaker2Model",
    "--judge-model": "judgeModel",
    "--coach-model": "coachModel",
    "--topic-model": "topicModel",
    "--narrator-model": "narratorModel",
    "--analysis-model": "analysisModel",
    "--prompt-model": "promptModel",
    "--summary-model": "summaryModel",
    "--name-model": "nameModel",
    "--parser-model": "parserModel",
  };
  for (let i = 0; i < rawArgs.length; i++) {
    const key = flagMap[rawArgs[i]];
    if (key && rawArgs[i + 1]) {
      overrides[key] = rawArgs[i + 1];
      i++;
    }
  }
  return overrides;
}

if (args.includes("--init-config")) {
  try {
    const filepath = initConfig();
    console.log(`Created config file: ${filepath}`);
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exit(1);
  }
  process.exit(0);
}

if (args.includes("--validate-config")) {
  const configPath = findProjectConfigPath();
  if (!configPath) {
    console.error("No config file found in current directory");
    console.error("Run --init-config to create one");
    process.exit(1);
  }
  const result = validateConfig(configPath);
  if (result.valid) {
    console.log(`\x1b[32m✓ Config file is valid: ${configPath}\x1b[0m`);
    process.exit(0);
  } else {
    console.error(`\x1b[31m✗ Config file has errors:\x1b[0m`);
    result.errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
}

if (args.includes("--show-config")) {
  const overrides = parseModelOverrides(args);
  const config = loadConfig(Object.keys(overrides).length > 0 ? overrides : undefined);
  console.log(formatResolvedConfig(config));
  process.exit(0);
}

if (args.includes("--show-models")) {
  const overrides = parseModelOverrides(args);
  const config = loadConfig(Object.keys(overrides).length > 0 ? overrides : undefined);
  console.log(formatModels(config));
  process.exit(0);
}

import React from "react";
import { render } from "ink";
import { App } from "./app.js";

export interface CliArgs {
  prompt?: string;
  speaker1?: string;
  speaker2?: string;
  seed1?: string;
  seed2?: string;
  turns?: number;
  topics?: number;
  issues?: string;
  humanCoach?: boolean;
  humanSide?: "speaker1" | "speaker2";
  debates?: number;
  autopilot?: boolean;
  forkFrom?: string;
  resume?: string;
  selfImprove?: boolean;
  model?: string;
  narrate?: boolean;
  judgeSeed?: string;
  // Per-role model overrides
  modelOverrides?: CLIModelOverrides;
}

function parseArgs(rawArgs: string[]): CliArgs {
  const result: CliArgs = {};
  const modelOverrides: CLIModelOverrides = {};

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    const nextArg = rawArgs[i + 1];

    switch (arg) {
      case "--prompt":
        result.prompt = nextArg;
        i++;
        break;
      case "--speaker1":
        result.speaker1 = nextArg;
        i++;
        break;
      case "--speaker2":
        result.speaker2 = nextArg;
        i++;
        break;
      case "--seed1":
        result.seed1 = nextArg;
        i++;
        break;
      case "--seed2":
        result.seed2 = nextArg;
        i++;
        break;
      case "--turns":
        result.turns = parseInt(nextArg, 10);
        i++;
        break;
      case "--rounds":
        console.error("\x1b[31mError: --rounds has been renamed to --turns\x1b[0m");
        console.error("Example: --turns 3");
        process.exit(1);
        break;
      case "--topics":
        result.topics = parseInt(nextArg, 10);
        i++;
        break;
      case "--questions":
        console.error("\x1b[31mError: --questions has been renamed to --topics\x1b[0m");
        console.error("Example: --topics 5");
        process.exit(1);
        break;
      case "--issues":
        result.issues = nextArg;
        i++;
        break;
      case "--human-coach":
        result.humanCoach = true;
        break;
      case "--no-human-coach":
        result.humanCoach = false;
        break;
      case "--human-side":
        if (nextArg === "speaker1" || nextArg === "speaker2") {
          result.humanSide = nextArg;
        }
        i++;
        break;
      case "--debates":
        result.debates = parseInt(nextArg, 10);
        i++;
        break;
      case "--autopilot":
        result.autopilot = true;
        break;
      case "--fork-from":
        result.forkFrom = nextArg;
        i++;
        break;
      case "--resume":
        result.resume = nextArg;
        i++;
        break;
      case "--self-improve":
        result.selfImprove = true;
        break;
      case "--no-self-improve":
        result.selfImprove = false;
        break;
      case "--model":
        result.model = nextArg;
        modelOverrides.model = nextArg;
        i++;
        break;
      case "--narrate":
        result.narrate = true;
        break;
      case "--no-narrate":
        result.narrate = false;
        break;
      case "--judge-seed":
        result.judgeSeed = nextArg;
        i++;
        break;
      // Per-role model overrides
      case "--speaker1-model":
        modelOverrides.speaker1Model = nextArg;
        i++;
        break;
      case "--speaker2-model":
        modelOverrides.speaker2Model = nextArg;
        i++;
        break;
      case "--judge-model":
        modelOverrides.judgeModel = nextArg;
        i++;
        break;
      case "--coach-model":
        modelOverrides.coachModel = nextArg;
        i++;
        break;
      case "--topic-model":
        modelOverrides.topicModel = nextArg;
        i++;
        break;
      case "--narrator-model":
        modelOverrides.narratorModel = nextArg;
        i++;
        break;
      case "--analysis-model":
        modelOverrides.analysisModel = nextArg;
        i++;
        break;
      case "--prompt-model":
        modelOverrides.promptModel = nextArg;
        i++;
        break;
      case "--summary-model":
        modelOverrides.summaryModel = nextArg;
        i++;
        break;
      case "--name-model":
        modelOverrides.nameModel = nextArg;
        i++;
        break;
      case "--parser-model":
        modelOverrides.parserModel = nextArg;
        i++;
        break;
      // Config commands are handled earlier
      case "--init-config":
      case "--show-config":
      case "--show-models":
      case "--validate-config":
        break;
      default:
        if (arg.startsWith("--")) {
          console.error(`\x1b[31mError: Unknown option "${arg}"\x1b[0m`);
          console.error("Run with --help to see available options");
          process.exit(1);
        }
        break;
    }
  }

  // Only add modelOverrides if any were specified
  if (Object.keys(modelOverrides).length > 0) {
    result.modelOverrides = modelOverrides;
  }

  return result;
}

const cliArgs = parseArgs(args);

const isTTY = process.stdin.isTTY;

// Create a mock stdin for non-TTY environments
import { Readable } from "stream";

let stdinStream: NodeJS.ReadStream | Readable = process.stdin;
if (!isTTY) {
  // Create a dummy readable stream that satisfies Ink but doesn't use raw mode
  const mockStdin = new Readable({ read() {} }) as unknown as NodeJS.ReadStream;
  (mockStdin as NodeJS.ReadStream & { isTTY: boolean }).isTTY = false;
  (mockStdin as NodeJS.ReadStream & { setRawMode: (mode: boolean) => NodeJS.ReadStream }).setRawMode = function() { return this as unknown as NodeJS.ReadStream; };
  stdinStream = mockStdin;
}

render(<App cliArgs={Object.keys(cliArgs).length > 0 ? cliArgs : undefined} />, {
  stdin: stdinStream as NodeJS.ReadStream,
});
