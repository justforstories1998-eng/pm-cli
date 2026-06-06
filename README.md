# PM CLI

> Universal AI Terminal · Ollama · Groq · OpenRouter · Google Gemini · Kimi · MiniMax · DeepSeek
╔══════════════════════════════════════════════════════╗
║ ║
║ ▀▄▀▄▀ PM CLI v1.0.0 ▀▄▀▄▀ ║
║ Universal AI Terminal · All Models ║
║ ║
╚══════════════════════════════════════════════════════╝

## Install

```bash
npm install -g pm-cli
That's it. One command. Then:

Bash

pm config setup
pm "Hello world"
Quick Start
Bash

npm install -g pm-cli      # install globally
pm config setup            # pick your provider + paste API key
pm "Explain Docker"        # one-shot message
pm                         # interactive chat session
The / Menu
Type / in chat and press Enter to open the full interactive menu.
Use ↑↓ arrow keys to navigate, A–Z to filter, Enter to select, Esc to cancel.

All Commands
Bash

pm                                    # interactive chat with default model
pm "message"                          # one-shot
pm chat                               # explicit chat command
pm -p groq                            # use groq provider
pm -m ollama:codellama                # use specific model
pm -s "Be concise"                    # custom system prompt
pm models                             # list all models
pm pull llama3.2                      # pull ollama model
pm status                             # check provider status
pm config show                        # show current config
pm config set provider groq
pm config set model llama-3.3-70b-versatile
pm config set groq-key sk_xxx
pm config set openrouter-key sk-or-xxx
pm config set google-key AIzaXXX
pm config set kimi-key sk-xxx
pm config set minimax-key xxx
pm config set deepseek-key sk-xxx
pm config setup                       # full interactive wizard
Slash Commands (in chat)
text

/                   open interactive menu
/help               show all commands
/model <name>       switch model
/clear              clear conversation history
/system <msg>       update system prompt
/save [file]        save conversation to file
/tokens             show token usage estimate
/retry              retry last message
/models             list all models
/upload <path>      upload file (image/pdf/docx/xlsx/zip/code...)
/paste-image        paste image from clipboard
/exit               quit
File Upload Support
Type	Extensions
Images	.jpg .jpeg .png .gif .webp .bmp .svg .tiff
Documents	.pdf .docx .txt .md
Spreadsheets	.xlsx .xls .ods
Archives	.zip (shows file listing)
Code	.js .ts .py .go .rs .java .c .cpp .cs .rb .php + 20 more
Data	.csv .json .xml .yaml .toml
Providers & Free API Keys
Provider	Free Tier	Get Key
Groq	Fastest free cloud	console.groq.com
OpenRouter	Most free models	openrouter.ai
Google Gemini	Gemini free tier	aistudio.google.com
Kimi	Moonshot AI / K2.6	platform.moonshot.cn
MiniMax	MiniMax 2.5	platform.minimaxi.com
DeepSeek	DeepSeek V3 + R1	platform.deepseek.com
Ollama	Fully local, always free	ollama.ai
Publish Your Own Fork
Bash

npm login
# edit package.json → change "name" to your own package name
git tag v1.0.0
git push && git push --tags
# GitHub Actions publishes to npm automatically
text


---

## How to Publish to npm (One-Time Setup)

### Step 1 — Create npm account
Go to [npmjs.com](https://www.npmjs.com) and create a free account.

### Step 2 — Check the name is available
```bash
npm info pm-cli
# If it says "404 Not Found" → name is free to use
# If taken, change "name" in package.json to something else like "pm-ai-cli"
Step 3 — Build and publish
Bash

git clone https://github.com/yourusername/pm-cli
cd pm-cli
npm install
npm run build
npm login
npm publish
Step 4 — That's it. Anyone can now run:
Bash

npm install -g pm-cli
pm config setup
pm "Hello world"