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
  --model <model>           Model ID (backend:model format, see below)
  --narrate                 Enable real-time narrator commentary (off by default)
  --no-narrate              Disable narrator commentary (default)
  --judge-seed <text>       Instructions for judge persona (e.g., "liberal judge aligned with Democratic party values")
  --help                    Show this help message

Model Selection:
  Direct APIs:
    openai:gpt-5.2                      GPT-5.2 via OpenAI
    google:gemini-2.5-flash             Gemini 2.5 Flash via Google
    google:gemini-3-pro-preview         Gemini 3 Pro via Google
    anthropic:claude-sonnet-4-5-20251101 Claude Sonnet 4.5 via Anthropic
    anthropic:claude-opus-4-5-20251101  Claude Opus 4.5 via Anthropic

  Via OpenRouter (any model):
    openrouter:openai/gpt-5.2           GPT-5.2 via OpenRouter
    openrouter:anthropic/claude-opus-4.5 Opus via OpenRouter
    qwen/qwen3-next-80b-a3b-instruct    Qwen 3 80B (default)

Environment:
  OPENROUTER_API_KEY              For OpenRouter models (tested)
  OPENAI_API_KEY                  For openai:* models
  ANTHROPIC_API_KEY               For anthropic:* models
  GOOGLE_GENERATIVE_AI_API_KEY    For google:* models

Examples:
  npx debate
  npx debate --prompt "5 debates between an atheist and a Catholic about morality"
  npx debate --speaker1 "Alex Epstein" --speaker2 "Al Gore" --issues "climate,energy"
  npx debate --speaker1 "Elon Musk" --speaker2 "Bill Gates" --debates 5 --autopilot

Keys during debate:
  1-9         Switch between active topic tabs
  Ctrl+C      Exit
`);
  process.exit(0);
}

import React from "react";
import { render } from "ink";
import { App } from "./app.js";

interface CliArgs {
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
}

function parseArgs(rawArgs: string[]): CliArgs {
  const result: CliArgs = {};

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
      case "--topics":
        result.topics = parseInt(nextArg, 10);
        i++;
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
    }
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
