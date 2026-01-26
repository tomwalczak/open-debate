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
  --speaker1 <name>         First speaker name or persona
  --speaker2 <name>         Second speaker name or persona
  --rounds <number>         Rounds per question (default: 3)
  --questions <number>      Number of debate questions (default: 5)
  --issues <topics>         Comma-separated focus topics
  --human-coach             Enable human coaching
  --no-human-coach          Disable human coaching
  --debates <number>        Number of debates to run
  --autopilot               Run debates without human intervention
  --fork                    Fork agents from existing match (use evolved prompts)
  --self-improve            Enable agent self-improvement (update prompts after debates)
  --model <model>           Model ID (default: qwen/qwen3-next-80b-a3b-instruct)
  --help                    Show this help message

Environment:
  OPENROUTER_API_KEY        Required API key for OpenRouter

Examples:
  npx debate
  npx debate --speaker1 "Alex Epstein" --speaker2 "Al Gore" --issues "climate,energy"
  npx debate --speaker1 "Elon Musk" --speaker2 "Bill Gates" --debates 5 --autopilot

Keys during debate:
  1-9         Switch between active debate tabs
  Ctrl+C      Exit
`);
  process.exit(0);
}

import React from "react";
import { render } from "ink";
import { App } from "./app.js";

interface CliArgs {
  speaker1?: string;
  speaker2?: string;
  rounds?: number;
  questions?: number;
  issues?: string;
  humanCoach?: boolean;
  debates?: number;
  autopilot?: boolean;
  fork?: boolean;
  selfImprove?: boolean;
  model?: string;
}

function parseArgs(rawArgs: string[]): CliArgs {
  const result: CliArgs = {};

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    const nextArg = rawArgs[i + 1];

    switch (arg) {
      case "--speaker1":
        result.speaker1 = nextArg;
        i++;
        break;
      case "--speaker2":
        result.speaker2 = nextArg;
        i++;
        break;
      case "--rounds":
        result.rounds = parseInt(nextArg, 10);
        i++;
        break;
      case "--questions":
        result.questions = parseInt(nextArg, 10);
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
      case "--debates":
        result.debates = parseInt(nextArg, 10);
        i++;
        break;
      case "--autopilot":
        result.autopilot = true;
        break;
      case "--fork":
        result.fork = true;
        break;
      case "--self-improve":
        result.selfImprove = true;
        break;
      case "--model":
        result.model = nextArg;
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
