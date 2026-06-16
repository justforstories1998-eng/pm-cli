# PM AI CLI

Universal AI terminal CLI — Ollama, Groq, OpenRouter, Google Gemini, Kimi, MiniMax, DeepSeek.

<div align="center">
  <a href="https://github.com/justforstories1998-eng/pm-cli">
    <img src="https://raw.githubusercontent.com/justforstories1998-eng/pm-cli/main/pm-ai-logo.svg" alt="PM AI" width="240" />
  </a>
  <pre>▀▄▀▄▀ PM AI CLI ▀▄▀▄▀</pre>
</div>

> If the logo image link doesn’t load for you (e.g., during preview), the CLI still works exactly the same.

---

## Install

```bash
npm install -g pm-ai-cli
```

Verify:

```bash
pm --version
pm --help
```

---

## First run (setup keys)

Run the wizard to set provider + API keys:

```bash
pm config setup
```

Then try:

```bash
pm "Hello world"
pm
```

---

## Quick usage

### One-shot message
```bash
pm "Explain Docker"
```

### Start interactive chat
```bash
pm chat
# or
pm
```

---

## Choose provider + model

Common options:

- `-p, --provider <provider>`: `groq | openrouter | ollama | google | kimi | minimax | deepseek`
- `-m, --model <model>`: model name
- `-s, --system <prompt>`: system prompt

Examples:

```bash
pm -p groq -m <model> "Hello"
pm -p ollama -m <model> "Hello"

pm or <openrouter-model>
pm -p openrouter -m "deepseek/deepseek-r1:free" "Explain quantum computing"
```

Provider shorthand commands:

```bash
pm groq "hello"
pm deepseek "explain Docker"
pm kimi "write a poem"
pm ollama
```

---

## Commands (complete list)

### Help / version
```bash
pm --help
pm -v
```

### Models
```bash
pm models
pm models <filter>
```

### Ollama
```bash
pm pull <model>
```

### Provider status
```bash
pm status
```

### Config
```bash
pm config show
pm config set <key> <value>
pm config setup
```

### Chat entrypoints
```bash
pm           # interactive chat
pm chat      # interactive chat
pm "<message>"  # one-shot
```

OpenRouter shortcut:
```bash
pm or <model>
pm -p openrouter -m <model> "<message>"
```

---

## Chat menu (slash commands)

Inside interactive chat, type `/` then press **Enter** to open the menu.

You can also use these slash commands directly:

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

---

## Building from source (dev / contributors)

```bash
npm ci
npm run build
node dist/index.js --help
```

---

## Publish (maintainers)

The project is published automatically by GitHub Actions on tags `v*`.

1. Bump version
2. Create a tag `vX.Y.Z`
3. Push the tag
