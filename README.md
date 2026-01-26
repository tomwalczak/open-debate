# Open Debate

AI-powered debate arena where language models argue opposing viewpoints.

## Quick Start

1. Get an API key from [OpenRouter](https://openrouter.ai)
2. Clone and setup:
   ```bash
   git clone <repo>
   cd open-debate
   npm install
   echo "OPENROUTER_API_KEY=your-key-here" > .env
   ```
3. Run a debate:
   ```bash
   npm start -- --speaker1 "Elon Musk" --speaker2 "Bill Gates" --autopilot
   ```

## Features

- Any persona vs any persona
- Parallel question execution (up to 5 at a time)
- AI judges each question
- Agents learn and improve over debates
- Human coaching mode

## CLI Options

| Flag | Description |
|------|-------------|
| `--speaker1, -s1` | First debater |
| `--speaker2, -s2` | Second debater |
| `--questions, -q` | Questions per debate (default: 5) |
| `--rounds, -r` | Rounds per question (default: 3) |
| `--debates, -d` | Number of debates |
| `--autopilot, -a` | Run without intervention |
| `--fork, -f` | Fork from existing agent prompts |
| `--model, -m` | Model ID (default: qwen/qwen3-next-80b-a3b-instruct) |
| `--issues, -i` | Comma-separated focus topics |
| `--human-coach, -hc` | Enable human coaching |

## Interactive Mode

Just run `npm start` for the setup wizard.

## How It Works

1. Questions generated based on speakers' known viewpoints
2. Each question: 3 rounds of back-and-forth (configurable)
3. Up to 5 questions run in parallel for faster debates
4. AI judge evaluates arguments, picks winner for each question
5. After debate: agents analyze performance and update prompts
6. Agents improve over multiple debates

## License

MIT
