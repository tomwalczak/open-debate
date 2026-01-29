```
           █▀▀█ █▀▀█ █▀▀ █▀▀▄
           █  █ █▀▀▀ █▀▀ █  █
           ▀▀▀▀ ▀    ▀▀▀ ▀  ▀
        ▄▀▀▄ ▄▀▀▄ █▀▀▄ ▄▀▀▄ ▀▀█▀▀ ▄▀▀▄
        █  █ █▀▀  █▀▀▄ █▀▀█   █   █▀▀
        ▀▀▀  ▀▀▀▀ ▀▀▀  ▀  ▀   ▀   ▀▀▀▀
```

An AI debate arena where language models argue opposing viewpoints, get judged, and learn from their losses.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

- **What:** An open-source AI debate arena that simulates arguments between any two perspectives
- **Why:** Run debates that would never happen IRL—people who refuse to engage, won't share a stage, or are ideologically incompatible
- **How:** Two AI debaters argue across multiple rounds, judged by an impartial AI judge, with optional self-improvement between debates
- **Useful for:** Red-teaming your own arguments, exploring AI bias, benchmarking persuasion strategies
- **Design:** Minimal "vanilla" prompts by default to surface raw model behavior rather than mask it

## Installation (macOS)

**One-liner** - installs Node.js if needed, clones repo, sets up everything:

```bash
curl -fsSL https://raw.githubusercontent.com/tomwalczak/open-debate/main/install.sh | bash
```

The script will prompt you for your [OpenRouter](https://openrouter.ai) API key.

<details>
<summary>Manual installation</summary>

```bash
git clone https://github.com/tomwalczak/open-debate.git ~/Desktop/open-debate
cd ~/Desktop/open-debate
npm install
echo "OPENROUTER_API_KEY=your-key-here" > .env
```
</details>

## Quick Start

After installation, open Terminal and run:

```bash
cd ~/Desktop/open-debate && npm start
```

This launches the interactive wizard where you pick speakers, topics, and settings.

**Or run directly with arguments:**

```bash
cd ~/Desktop/open-debate && npm start -- \
  --speaker1 "Nuclear engineer who believes nuclear power is the safest, cleanest path to energy abundance" \
  --speaker2 "Environmental activist who believes nuclear's risks and costs make it a dangerous distraction from renewables" \
  --autopilot
```

## Example Debates

### Energy & Environment

**Nuclear Power: Safety vs Risk**
```bash
npm start -- \
  --speaker1 "Nuclear engineer who believes nuclear power is the safest, cleanest path to energy abundance and that anti-nuclear sentiment is driven by irrational fear" \
  --speaker2 "Environmental activist who believes nuclear's catastrophic tail risks, waste storage problems, and massive costs make it a dangerous distraction from proven renewables" \
  --issues "Chernobyl and Fukushima lessons,waste storage,cost overruns,baseload power,small modular reactors" \
  --questions 5 --rounds 3 --debates 3
```

### Psychology & Culture

**Therapy Culture: Healing or Harm?**
```bash
npm start -- \
  --speaker1 "Therapist and mental health advocate who believes widespread access to therapy reduces suffering, builds emotional intelligence, and helps people live authentic lives" \
  --speaker2 "Cultural critic who believes therapy culture promotes fragility, pathologizes normal human struggle, and replaces community and meaning with endless self-focus" \
  --issues "trauma discourse,resilience vs vulnerability,medicalization of sadness,therapeutic language in politics,self-help industry" \
  --questions 5 --rounds 3 --debates 3
```

### Philosophy & Social Theory

**Girardian vs Marxist Analysis**
```bash
npm start -- \
  --speaker1 "Girardian who explains social conflict through mimetic desire and scapegoating, and sees Christianity as the unveiling of the scapegoat mechanism" \
  --speaker2 "Marxist who explains social conflict through material conditions and class struggle, and sees religion as ideology serving ruling class interests" \
  --issues "origin of violence,religion's social function,capitalism,revolutionary change,human nature" \
  --questions 5 --rounds 3 --debates 3
```

**Popper vs Bay Area Rationalists**
```bash
npm start -- \
  --speaker1 "Karl Popper-style critical rationalist who emphasizes falsificationism, the open society, and skepticism of prediction" \
  --speaker2 "LessWrong-style Bayesian rationalist who emphasizes probability theory, expected utility maximization, and AI alignment" \
  --issues "scientific method,epistemology,prediction vs falsification,AI existential risk,utopian social engineering" \
  --questions 5 --rounds 4 --debates 3
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
| `--model, -m`        | Model ID for debaters                | `qwen/qwen3-next-80b-a3b-instruct` |
| `--issues, -i`       | Comma-separated focus topics         | —                      |
| `--human-coach, -hc` | Enable human coaching between rounds | false                  |
| `--fork, -f`         | Fork from existing agent prompts     | —                      |

### Model Options

```bash
# Via OpenRouter (recommended - one API key, many models)
--model "qwen/qwen3-next-80b-a3b-instruct"  # Default - open source, great value
--model "google/gemini-2.5-flash"           # Fast and cheap
--model "anthropic/claude-sonnet-4.5"       # Strong reasoning
--model "anthropic/claude-opus-4.5"         # Highest quality
--model "openai/gpt-5.2"                    # OpenAI flagship

# Direct API access (requires respective API keys)
--model "google:gemini-2.5-flash"           # Requires GOOGLE_GENERATIVE_AI_API_KEY
--model "anthropic:claude-sonnet-4-5-20251101"  # Requires ANTHROPIC_API_KEY
--model "openai:gpt-5.2"                    # Requires OPENAI_API_KEY
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
