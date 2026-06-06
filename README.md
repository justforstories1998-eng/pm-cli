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
npm install -g pm-ai-cli
That's it. One command. Then:

Bash

pm config setup
pm "Hello world"
Quick Start
Bash

npm install -g pm-ai-cli      # install globally
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

# One shot message
pm -p openrouter "Hello world"

# Specific model
pm -p openrouter -m "deepseek/deepseek-r1:free" "Explain quantum computing"

# Interactive chat
pm -p openrouter

# Set as default provider
pm config set provider openrouter
pm config set model "deepseek/deepseek-r1:free"

# Now just type
pm "Hello"

# ─── OpenRouter — set key ONCE ──────────────────────────
pm config set openrouter-key sk-or-v1-xxx
pm -p openrouter "Hello"          # works forever no key prompt

# ─── Quick model switch ──────────────────────────────────
pm                                 # start chat
/orm                               # opens model switcher
# ↑↓ to browse, type to filter, Enter to select

# ─── File reading ────────────────────────────────────────
/read src/index.ts                 # show file in terminal
/preview src/index.ts 30           # show first 30 lines
/readask src/config.ts "what does this do?"
/askfiles src/index.ts src/config.ts -- "explain this code"

# ─── File editing ────────────────────────────────────────
/write hello.txt "Hello World"     # create a file
/append notes.txt "new line"       # add to file
/replace config.ts "old" "new"     # find and replace
/delete temp.txt                   # delete (with backup)
/mkdir src/newfeature              # create directory

# ─── AI assisted editing ─────────────────────────────────
/aiedit src/index.ts "add error handling to the main function"
/savereply src/index.ts            # save AI response to file

# ─── Search ──────────────────────────────────────────────
/ls                                # list current directory
/tree src                          # show src folder tree
/search "TODO" src                 # find TODOs in src/
/search "import" .                 # find all imports

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
Step 4 — That's it.

# ─── Just type naturally — no /read needed ─────────────
pm
> fix history.ts file
# AI automatically reads history.ts, fixes it, offers to save

> fix everything
# AI reads all project files, fixes all errors, offers to save

> explain what config.ts does
# AI automatically reads config.ts and explains it

> update the system prompt in config.ts to be more helpful
# AI reads config.ts, makes change, asks to apply

# ─── OpenRouter — seamless ─────────────────────────────
pm or                          # opens OpenRouter chat immediately
pm or deepseek/deepseek-r1:free # specific model, starts chat
pm -p openrouter               # same thing

# Inside chat — switch models without leaving
/orm                           # opens visual model switcher
/orm deepseek/deepseek-r1:free # switch directly by name

# ─── Provider shortcuts ─────────────────────────────────
pm groq "hello"                # chat with groq
pm deepseek "explain Docker"   # chat with deepseek
pm kimi "write a poem"         # chat with kimi
pm ollama                      # chat with local ollama
pm or                          # chat with openrouter
