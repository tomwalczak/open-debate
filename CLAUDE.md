# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Open Debate is a terminal-based AI debate arena where language models argue opposing viewpoints, get judged by an AI judge, and learn from their losses through a self-improvement loop. Built with React 19, Ink 6 (terminal UI), and the Vercel AI SDK.

**This is a monorepo** with two packages:
- `@open-debate/core` - Pure business logic (types, services, utilities) - no UI dependencies
- `@open-debate/cli` - Terminal UI built with Ink/React that consumes the core package

## Commands

```bash
bun run start                    # Run with interactive wizard
bun run start -- --speaker1 "..." --speaker2 "..." --autopilot  # CLI mode
bun run build                    # Build both packages (core then cli)
bun run dev                      # Watch mode for cli
```

There are no tests configured in this project.

## Monorepo Structure

```
open-debate/
├── packages/
│   ├── core/                    # @open-debate/core - Pure business logic
│   │   ├── src/
│   │   │   ├── types/           # AgentConfig, MatchConfig, DebateState, etc.
│   │   │   ├── utils/           # id.ts, logger.ts
│   │   │   ├── services/        # All business logic (14 services)
│   │   │   └── index.ts         # Main barrel export
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── cli/                     # @open-debate/cli - Terminal UI
│       ├── src/
│       │   ├── components/      # Ink/React components (24 files)
│       │   │   └── Wizard/      # 6 input screens
│       │   ├── theme.ts         # CLI styling
│       │   ├── app.tsx          # State orchestrator
│       │   └── index.tsx        # Entry point
│       ├── bin/debate.js        # CLI binary
│       ├── package.json
│       └── tsconfig.json
│
├── package.json                 # Workspace root
├── tsconfig.base.json           # Shared compiler options
└── .env                         # API keys (gitignored)
```

## Architecture

### Data Flow

```
CLI args / Wizard → App (state orchestrator) → runMatch (match-engine.ts)
    → Topic generation → Parallel topic execution (max 5 concurrent)
    → For each topic: Turn exchanges → Judge verdict
    → Self-improvement loop → Next debate
```

### Key Services (packages/core/src/services/)

- **model-provider.ts** - Multi-backend model initialization (OpenAI, Anthropic, Google, OpenRouter). Format: `backend:model-id` or just `model-id` (defaults to OpenRouter)
- **match-engine.ts** - High-level match orchestration with `TopicPool` for concurrent topic execution
- **debate-engine.ts** - `runDebate`, `generateSpeakerResponse` with streaming
- **agent-learner.ts** - Self-improvement via `generateSelfAnalysis`, writes to `learnings.md`
- **judge-service.ts** - `verdictSchema` validation with Zod, `calculateFinalTally`
- **match-storage.ts** - Filesystem persistence to `matches/*/`

### Key Types (packages/core/src/types/)

- **AgentConfig** - id, name, systemPrompt, modelId, dirPath
- **MatchConfig**, **DebateState**, **WizardState** in debate.ts
- **JudgeVerdict**, **FinalTally**, **MatchSummary** in judge.ts

### Component Structure (packages/cli/src/components/)

- **MatchView.tsx** - Main match display with tabbed topics
- **DebateView.tsx** - Single debate view
- **TopicTabBar.tsx** - Tab navigation (1-9 keys)
- **Wizard/** - 6 input screens for interactive setup

### Important Constants

- `PROMPT_MAX_LENGTH = 5000` (packages/core/src/types/agent.ts) - Max agent prompt size
- `DEFAULT_MODEL_ID = "qwen/qwen3-next-80b-a3b-instruct"` - Default model via OpenRouter
- Max concurrent topics: 5 (prevents API rate limiting)

## Importing from Core

The CLI imports all types and services from the core package:

```typescript
import {
  runMatch,
  type MatchConfig,
  type MatchState,
  DEFAULT_MODEL_ID,
} from "@open-debate/core";
```

## Model Provider Pattern

Models are specified as `backend:model-id` or just `model-id`:
- `openai:gpt-5.2` - Direct OpenAI API
- `anthropic:claude-opus-4-5-20251101` - Direct Anthropic API
- `google:gemini-2.5-flash` - Direct Google API
- `qwen/qwen3-next-80b-a3b-instruct` - OpenRouter (default when no prefix)

Required env vars: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENROUTER_API_KEY`

## Output Structure

```
matches/{DATE}-{SEQ}-{S1}-vs-{S2}-{ADJ-NOUN}/
├── config.json
├── debate-N/
│   ├── topics.json
│   ├── transcript.json
│   └── verdicts.json
├── agents/{speaker-id}/
│   ├── prompt.txt
│   └── learnings.md
└── match-summary.json
```

## Theme

Centralized in `packages/cli/src/theme.ts` - cyan accent, minimal monochrome design.
