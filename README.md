# PM AI CLI

Universal AI terminal CLI — Ollama, Groq, OpenRouter, Google Gemini, Kimi, MiniMax, DeepSeek.

```text
  ▄▄▄▄▄  ▄▄▄▄▀ ▄▄▄▄▄ ▄▄▄▄▀  ▄▄▄▄▄ ▄▄▄▄▀  ▄▄▄▄▄ ▄▄▄▄▀
 █████  ███    █████  ███   █████  ███   █████  ███
  ▀▀▀▀▀  ▀▀▀    ▀▀▀▀▀  ▀▀▀    ▀▀▀▀▀  ▀▀▀   ▀▀▀▀▀  ▀▀▀
```

> The CLI workflow is the same for all providers: **set config → run `pm`**.
> If the logo doesn’t render, the CLI still works normally.

---

## 1) Install

```bash
npm install -g pm-ai-cli
```

Verify installation:

```bash
pm --version
pm --help
```

---

## 2) First run (recommended step-by-step)

### Step A — Start setup wizard
```bash
pm config setup
```

This wizard guides you to:
- pick your **provider**
- paste the appropriate **API key**
- (optionally) set a default **model**

### Step B — Confirm config exists
```bash
pm config show
```

### Step C — Run your first message
```bash
pm "Hello world"
```

### Step D — Start interactive chat (menu + slash commands)
```bash
pm
```

---

## 3) Provider selection (how to switch quickly)

CLI options you can reuse:

- `-p, --provider <provider>`: `groq | openrouter | ollama | google | kimi | minimax | deepseek`
- `-m, --model <model>`: provider model name
- `-s, --system <prompt>`: system prompt override

### Examples

```bash
# Groq
pm -p groq -m <model> "Hello"

# Ollama (local)
pm -p ollama -m <model> "Hello"

# OpenRouter (shortcut)
pm or deepseek/deepseek-r1:free

# OpenRouter with system prompt
pm -p openrouter -m "deepseek/deepseek-r1:free" -s "Be concise" "Explain Docker"
```

---

## 4) Full command list (with examples)

### Help / version
```bash
pm --help
pm -v
```

### One-shot message (default provider/model)
```bash
pm "Explain quantum computing"
```

### Interactive chat
```bash
pm
pm chat
```

---

### Provider shortcut commands
```bash
pm groq "hello"
pm deepseek "explain Docker"
pm kimi "write a poem"

# Ollama (local)
pm ollama
# or: pm ollama "your message"
```

---

### Models (list available models)
```bash
pm models
pm models <filter>
```

### Pull (Ollama model)
```bash
pm pull llama3.2
```

### Status (provider status)
```bash
pm status
```

---

### Config commands
```bash
pm config show
pm config set <key> <value>
pm config setup
```

Common keys (depending on provider):
- `provider`
- `model`
- `<provider>-key` (e.g., `openrouter-key`, `groq-key`, `google-key`, etc.)

---

### OpenRouter shortcut
```bash
pm or <openrouter-model>
pm or deepseek/deepseek-r1:free
pm -p openrouter -m "deepseek/deepseek-r1:free" "Hello"
```

---

## 5) Chat menu + slash commands

### Open the interactive menu
In interactive chat, type `/` and press **Enter**.

### Slash commands (quick reference)
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

## 6) Building from source (contributors)

```bash
npm ci
npm run build
node dist/index.js --help
```

---

## 7) Publish (maintainers)

The project is published automatically by GitHub Actions on tags `v*`.

1. Bump version
2. Create tag `vX.Y.Z`
3. Push tag (publish workflow runs)
