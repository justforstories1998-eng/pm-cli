# PM CLI

Universal AI Terminal CLI — Ollama, Groq, OpenRouter, Google Gemini, Kimi, MiniMax, DeepSeek.

<div align="center">
  <pre>
    ▀▄▀▄▀ PM CLI ▀▄▀▄▀
  </pre>
</div>

## Install

```bash
npm install -g pm-ai-cli
```

Verify:

```bash
pm --version
pm --help
```

## First run

Run the setup wizard to store API keys / config:

```bash
pm config setup
```

Then:

```bash
pm "Hello world"
pm
```

## Usage

### One-shot message

```bash
pm "Explain Docker"
```

### Interactive chat

```bash
pm chat
# or
pm
```

### Provider + model

```bash
pm -p groq -m <model> "Hello"
pm -p ollama -m <model> "Hello"

pm or <openrouter-model>
pm -p openrouter -m "deepseek/deepseek-r1:free" "Explain quantum computing"
```

### Common commands

```bash
pm models                 # list all available models
pm pull <model>          # pull an Ollama model
pm status                 # check provider status
pm config show            # show current config
pm config set <k> <v>   # set a config value
```

## Chat menu (/)

Inside chat, type `/` and press Enter to open the interactive menu.

## Chat slash commands (quick reference)

```text
/orm                  Open model switcher
/upload <path>       Upload a file (image/pdf/docx/xlsx/zip/code...)
/retry                Retry last message
/save [file]         Save conversation to a file
/tokens               Show token usage estimate
/system <msg>        Update system prompt
/help                 Show all commands
/exit                 Quit
```

## Building from source

```bash
npm ci
npm run build
node dist/index.js --help
```

## Publish (maintainers)

The project is published automatically by GitHub Actions on tags `v*`.

1. Bump version
2. Create a tag `vX.Y.Z`
3. Push the tag

