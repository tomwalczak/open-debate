# Open Debate

An AI debate arena where language models argue opposing viewpoints, get judged, and learn from their losses.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

- **What:** An open-source AI debate arena that simulates arguments between any two perspectives
- **Why:** Run debates that would never happen IRL—people who refuse to engage, won't share a stage, or are ideologically incompatible
- **How:** Two AI debaters argue across multiple rounds, judged by an impartial AI judge, with optional self-improvement between debates
- **Useful for:** Red-teaming your own arguments, exploring AI bias, benchmarking persuasion strategies
- **Design:** Minimal "vanilla" prompts by default to surface raw model behavior rather than mask it

## Installation

```bash
git clone https://github.com/your-username/open-debate.git
cd open-debate
npm install
```

Set your API key (get one from [OpenRouter](https://openrouter.ai)):

```bash
echo "OPENROUTER_API_KEY=your-key-here" > .env
```

## Quick Start

**Interactive mode** (recommended for first run):

```bash
npm start
```

This launches a setup wizard where you pick speakers, topics, and settings.

**Command line mode**:

```bash
npm start -- --speaker1 "Elon Musk" --speaker2 "Bill Gates" --autopilot
```

## Example Debates

### Constitutional & Political

**Originalism vs Living Constitution**
```bash
npm start -- \
  --speaker1 "Antonin Scalia-style originalist who believes the Constitution should be interpreted as the Founders intended" \
  --speaker2 "Living constitutionalist who believes the Constitution must evolve with society" \
  --questions 5 --rounds 3 --debates 3
```

**Immigration Deep Dive**
```bash
npm start -- \
  --speaker1 "Immigration restrictionist who prioritizes border security, wage protection for workers, and cultural cohesion" \
  --speaker2 "Pro-immigration advocate who emphasizes economic benefits, humanitarian obligations, and America's immigrant heritage" \
  --issues "asylum policy,economic impact,integration,border enforcement,legal immigration reform" \
  --questions 5 --rounds 4 --debates 3
```

### Philosophy of Science & Rationality

**Popper vs Bay Area Rationalists**
```bash
npm start -- \
  --speaker1 "Karl Popper-style critical rationalist who emphasizes falsificationism, the open society, and the limits of induction" \
  --speaker2 "LessWrong-style Bayesian rationalist who emphasizes probability theory, expected utility, and AI alignment" \
  --issues "scientific method,epistemology,prediction vs falsification,AI risk,social engineering" \
  --questions 5 --rounds 4 --debates 3
```

**Girardian vs Marxist Analysis**
```bash
npm start -- \
  --speaker1 "Girardian who explains social conflict through mimetic desire and scapegoating" \
  --speaker2 "Marxist who explains social conflict through material conditions and class struggle" \
  --issues "violence,religion,capitalism,social change" \
  --questions 5 --rounds 3 --debates 3
```

## How It Works

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MATCH (e.g., 3 debates)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐          │
│   │  DEBATE 1   │ ──────► │  DEBATE 2   │ ──────► │  DEBATE 3   │          │
│   └─────────────┘         └─────────────┘         └─────────────┘          │
│         │                       │                       │                   │
│         ▼                       ▼                       ▼                   │
│   ┌───────────┐           ┌───────────┐           ┌───────────┐            │
│   │   Both    │           │   Both    │           │  Final    │            │
│   │  Reflect  │           │  Reflect  │           │  Summary  │            │
│   │  & Learn  │           │  & Learn  │           │           │            │
│   └───────────┘           └───────────┘           └───────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

A **match** contains multiple debates. After each debate, both agents reflect on what worked and what didn't, then update their strategies. This is the **self-improvement loop**.

### Inside a Single Debate

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 DEBATE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐                                                       │
│  │ QUESTION         │  Generates debate questions based on                  │
│  │ GENERATOR        │  the speakers' personas and any --issues              │
│  └────────┬─────────┘                                                       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      FOR EACH QUESTION                              │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                    FOR EACH ROUND                           │   │   │
│  │  │                                                             │   │   │
│  │  │   ┌───────────┐              ┌───────────┐                  │   │   │
│  │  │   │ SPEAKER 1 │ ──responds── │ SPEAKER 2 │                  │   │   │
│  │  │   │           │ ◄──rebuts─── │           │                  │   │   │
│  │  │   └───────────┘              └───────────┘                  │   │   │
│  │  │                                                             │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                          │                                          │   │
│  │                          ▼                                          │   │
│  │                   ┌─────────────┐                                   │   │
│  │                   │    JUDGE    │  Evaluates arguments,             │   │
│  │                   │             │  picks winner for this question   │   │
│  │                   └─────────────┘                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Final tally: Speaker with most question wins takes the debate              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Self-Improvement Flow

```
                         DEBATE N ENDS
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
   ┌─────────────────────┐             ┌─────────────────────┐
   │  SPEAKER 1 REFLECTS │             │  SPEAKER 2 REFLECTS │
   │                     │             │                     │
   │  • What worked?     │             │  • What worked?     │
   │  • What failed?     │             │  • What failed?     │
   │  • Judge feedback   │             │  • Judge feedback   │
   └──────────┬──────────┘             └──────────┬──────────┘
              │                                   │
              ▼                                   ▼
   ┌─────────────────────┐             ┌─────────────────────┐
   │  Updated prompt     │             │  Updated prompt     │
   │  with new tactics   │             │  with new tactics   │
   └──────────┬──────────┘             └──────────┬──────────┘
              │                                   │
              └─────────────────┬─────────────────┘
                                ▼
                   ┌─────────────────────┐
                   │     DEBATE N+1      │
                   │  (both evolved)     │
                   └─────────────────────┘
```

Both agents' prompts accumulate lessons: "Don't concede X," "Reframe Y as Z," "Lead with evidence on topic W." Over multiple debates, you can watch both personas sharpen as they adapt to each other.

## CLI Options

| Flag                 | Description                          | Default                |
| -------------------- | ------------------------------------ | ---------------------- |
| `--speaker1, -s1`    | First debater persona                | —                      |
| `--speaker2, -s2`    | Second debater persona               | —                      |
| `--questions, -q`    | Questions per debate                 | 5                      |
| `--rounds, -r`       | Rounds per question                  | 3                      |
| `--debates, -d`      | Number of consecutive debates        | 1                      |
| `--autopilot, -a`    | Run without pausing                  | false                  |
| `--model, -m`        | Model ID for debaters                | `qwen/qwen3-235b-a22b` |
| `--issues, -i`       | Comma-separated focus topics         | —                      |
| `--human-coach, -hc` | Enable human coaching between rounds | false                  |
| `--fork, -f`         | Fork from existing agent prompts     | —                      |

### Model Options

```bash
# Via OpenRouter (recommended - one API key, many models)
--model "qwen/qwen3-235b-a22b"              # Default, good balance
--model "anthropic/claude-sonnet-4"         # Strong reasoning
--model "openai/gpt-4o"                     # OpenAI flagship

# Direct API access (requires respective API keys)
--model "anthropic:claude-sonnet-4"         # Requires ANTHROPIC_API_KEY
--model "openai:gpt-4o"                     # Requires OPENAI_API_KEY
--model "google:gemini-2.0-flash"           # Requires GOOGLE_GENERATIVE_AI_API_KEY
```

### Keyboard Controls During Debate

| Key | Action |
|-----|--------|
| `1-9` | Jump to question tab |
| `Tab` | Cycle through questions |
| `↑/↓` | Scroll debate transcript |
| `←/→` | Navigate tabs |
| `Ctrl+C` | Exit |

## Output Files

Each match creates a folder in `matches/` containing:

```
matches/2026-01-27-debate-name/
├── config.json           # Full match configuration
├── debate-1/
│   ├── questions.json    # Generated debate questions
│   ├── transcript.json   # Full exchange transcript
│   └── verdicts.json     # Judge decisions + reasoning
├── debate-2/
│   └── ...
├── speaker1-evolution.json  # How speaker1's prompt evolved
├── speaker2-evolution.json  # How speaker2's prompt evolved
└── match-summary.json       # Final analysis
```

## Tips

- **Longer personas = better debates.** "MAGA supporter" is okay; "MAGA supporter who believes in America First policies, border security, and returning to traditional values while opposing globalist elites" is better.
- **Use `--issues` to focus.** Without it, the AI generates questions. With it, you control the terrain.
- **Run multiple debates.** Single debates are noisy. Three debates with self-improvement gives you signal.
- **Try different models as judges.** Claude, GPT, and Gemini have different priors. Interesting to see where they diverge.
- **Fork successful runs.** If a debater evolves into something interesting, use `--fork` to continue from that point.

## Interesting Observations

Patterns that emerge from running many debates:

### The Empiricist Bias

LLM judges tend to reward specificity and statistics over principled reasoning. Even dubious stats like "McKinsey found 53%..." rank higher than clear first-principles arguments. This matters if you're testing arguments that rely on causal reasoning—they may lose to weaker arguments that cite more numbers.

### Mode Collapse in Self-Improvement

Over many iterations, agents can fall into local minima—repeating arguments that won before rather than exploring new strategies. The self-improvement loop optimizes for beating *this* opponent with *this* judge, not for general persuasiveness.

### Model Differences

Running debates with different models as judge produces different results. Chinese models (DeepSeek, Qwen) have different training data and value alignment than Western models. Where do they agree? Where do they diverge?

## Contributing

Contributions welcome! Some areas that could use help:

- **New judge personas** - Different judging styles and criteria
- **Better learning algorithms** - More sophisticated self-improvement
- **Model comparisons** - Benchmarking different LLMs as debaters
- **Tournament mode** - Bracket-style competitions

## License

MIT
