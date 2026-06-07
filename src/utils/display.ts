import chalk from "chalk";

// ─── Theme Colors — Dark Glassmorphism ───────────────────────────────────────
export const C = {
  // ─── New color names ──────────────────────────────────────────────────────
  white:        chalk.hex("#FFFFFF"),
  white90:      chalk.hex("#E6E6E6"),
  white70:      chalk.hex("#B3B3B3"),
  white40:      chalk.hex("#666666"),
  white20:      chalk.hex("#333333"),

  // Violet / Purple accents
  violet:       chalk.hex("#8B5CF6"),
  violetBright: chalk.hex("#A78BFA"),
  violetDim:    chalk.hex("#4C1D95"),
  indigo:       chalk.hex("#6366F1"),
  fuchsia:      chalk.hex("#D946EF"),

  // Background tones
  bgDark:       chalk.bgHex("#0A0A0B"),
  bgCard:       chalk.bgHex("#111113"),
  bgBorder:     chalk.hex("#1A1A1F"),
  bgHover:      chalk.bgHex("#1C1C21"),

  // Status
  success:      chalk.hex("#10B981"),
  error:        chalk.hex("#EF4444"),
  warning:      chalk.hex("#F59E0B"),
  info:         chalk.hex("#6366F1"),

  // Dim
  dim:          chalk.hex("#444449"),
  dimBright:    chalk.hex("#666670"),

  // ─── Backward compatibility aliases ───────────────────────────────────────
  red:          chalk.hex("#8B5CF6"),
  redBright:    chalk.hex("#A78BFA"),
  redDim:       chalk.hex("#4C1D95"),
  whiteDim:     chalk.hex("#A0A0A0"),
  gray:         chalk.hex("#555560"),
  grayDark:     chalk.hex("#333338"),
  selectedBg:   chalk.bgHex("#2D1B69").hex("#E0D7FF"),
};

function getTerminalWidth(): number {
  // process.stdout.columns may be undefined in some environments
  const cols = process.stdout.columns || 60;

  // Leave some breathing room for borders + ANSI variance
  // Clamp to avoid giant layouts or extremely narrow terminals
  return Math.max(50, Math.min(100, cols - 2));
}

const WIDTH = getTerminalWidth();

// ─── Strip ANSI codes ─────────────────────────────────────────────────────────
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*m/g, "").replace(/\x1B\[\d+[A-Z]/g, "");
}

// ─── Pad right keeping visual width ──────────────────────────────────────────
function pad(str: string, width: number): string {
  const len = stripAnsi(str).length;
  return str + " ".repeat(Math.max(0, width - len));
}

// ─── Center text ──────────────────────────────────────────────────────────────
function center(text: string, width: number): string {
  const len = stripAnsi(text).length;
  const total = Math.max(0, width - len);
  const left = Math.floor(total / 2);
  const right = total - left;
  return " ".repeat(left) + text + " ".repeat(right);
}

// ─── Gradient text simulation ─────────────────────────────────────────────────
function gradientText(text: string): string {
  const colors = [
    "#FFFFFF", "#F5F5FF", "#EBEBFF", "#E0D7FF",
    "#D4C5FF", "#C4B0FF", "#B39DFF", "#A78BFA",
  ];
  return text
    .split("")
    .map((char, i) => {
      const color = colors[Math.min(i, colors.length - 1)];
      return chalk.hex(color)(char);
    })
    .join("");
}

// ─── Wrap text ────────────────────────────────────────────────────────────────
function wrapText(text: string, width: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.includes("\n")) {
      const parts = word.split("\n");
      for (let i = 0; i < parts.length; i++) {
        if (i === 0) {
          if (current.length + parts[i].length + 1 > width) {
            if (current) lines.push(current);
            current = parts[i];
          } else {
            current = current ? `${current} ${parts[i]}` : parts[i];
          }
        } else {
          if (current) lines.push(current);
          current = parts[i];
        }
      }
      continue;
    }
    if (current.length + word.length + 1 > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

// ─── Format bytes ─────────────────────────────────────────────────────────────
function formatBytesDisplay(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ─── Provider icon ────────────────────────────────────────────────────────────
function getProviderIcon(provider: string): string {
  const icons: Record<string, string> = {
    openrouter: "◈",
    groq:       "⚡",
    ollama:     "◉",
    google:     "✦",
    kimi:       "◎",
    minimax:    "◇",
    deepseek:   "◆",
  };
  return icons[provider] || "◈";
}

// ─── BANNER ───────────────────────────────────────────────────────────────────
function printPmAiLogo(): void {
  const w = WIDTH;

  const visible = (s: string) => stripAnsi(s).length;
  const padLeftFor = (s: string, extraRight = 0) => {
    const left = Math.floor((w - 2 - visible(s)) / 2);
    return Math.max(0, left + extraRight);
  };
  const render = (s: string, extraRight = 0) => {
    return "  " + " ".repeat(padLeftFor(s, extraRight)) + s;
  };

  // Small visual nudge requested by user (first line only)
  const SHIFT_RIGHT = 5;

  const l1 =
    chalk.hex("#A78BFA")("██████╗ ███╗   ███╗      █████╗ ██╗") +
    chalk.hex("#6366F1")("  ▸  ") +
    chalk.hex("#D946EF")("PM-AI");

  const l2 = chalk.hex("#4C1D95")("██╔══██╗████╗ ████║     ██╔══██╗██║");
  const l3 = chalk.hex("#6366F1")("██████╔╝██╔████╔██║     ███████║██║");
  const l4 = chalk.hex("#4C1D95")("██╔═══╝ ██║╚██╔╝██║     ██╔══██║██║");
  const l5 = chalk.hex("#6366F1")("██║     ██║ ╚═╝ ██║     ██║  ██║██║");
  const l6 = chalk.hex("#4C1D95")("╚═╝     ╚═╝     ╚═╝     ╚═╝  ╚═╝╚═╝");

  console.log();
  console.log(render(l1, SHIFT_RIGHT));
  console.log(render(l2));
  console.log(render(l3));
  console.log(render(l4));
  console.log(render(l5));
  console.log(render(l6));
  console.log();
}

export function printCleanBanner(): void {
  // Logo (startup only)
  printPmAiLogo();

  // Glow line
  console.log("  " + C.violetDim("▄".repeat(WIDTH - 2)));

  // Glass card
  console.log("  " + C.dim("╭") + C.dim("─".repeat(WIDTH - 2)) + C.dim("╮"));
  console.log("  " + C.dim("│") + " ".repeat(WIDTH - 2) + C.dim("│"));

  // Gradient title
  const title = gradientText("How can I help today?");
  console.log(
    "  " + C.dim("│") +
    center(title, WIDTH - 2) +
    C.dim("│")
  );

  // Divider dots
  const divider = C.dim("·".repeat(Math.floor((WIDTH - 4) / 2)));
  console.log(
    "  " + C.dim("│") +
    center(divider, WIDTH - 2) +
    C.dim("│")
  );

  // Subtitle
  console.log(
    "  " + C.dim("│") +
    center(C.white40("Type a command or ask a question"), WIDTH - 2) +
    C.dim("│")
  );

  console.log("  " + C.dim("│") + " ".repeat(WIDTH - 2) + C.dim("│"));
  console.log("  " + C.dim("╰") + C.dim("─".repeat(WIDTH - 2)) + C.dim("╯"));
  console.log();
}

// ─── SESSION HEADER ───────────────────────────────────────────────────────────
export function printHeader(provider: string, model: string): void {
  const providerIcon = getProviderIcon(provider);
  const modelShort = model.length > 35 ? model.slice(0, 32) + "…" : model;
  const w = WIDTH;

  console.log();
  console.log(
    "  " + C.dim("╭─ ") + C.violet("SESSION ") + C.dim("─".repeat(w - 12)) + C.dim("╮")
  );
  console.log(
    "  " + C.dim("│") +
    pad("  " + C.white40(`${providerIcon} Provider  `) + C.white90(provider), w) +
    C.dim("│")
  );
  console.log(
    "  " + C.dim("│") +
    pad("  " + C.white40("◈ Model     ") + C.violetBright(modelShort), w) +
    C.dim("│")
  );
  console.log(
    "  " + C.dim("│") +
    pad("  " + C.dim("⌘ Tip       ") + C.dim("/ for menu  Ctrl+C to exit"), w) +
    C.dim("│")
  );
  console.log(
    "  " + C.dim("╰") + C.dim("─".repeat(w)) + C.dim("╯")
  );
  console.log();
}

// ─── YOU MESSAGE ─────────────────────────────────────────────────────────────
export function printUserMessage(content: string, hasFiles?: boolean): void {
  const w = WIDTH;
  console.log();

  // User badge
  console.log(
    "  " +
    chalk.bgHex("#1C1C21")(C.white40(" ") + C.white90("  You  ") + C.white40(" ")) +
    (hasFiles ? "  " + C.violet("⎙ files attached") : "")
  );

  // Message bubble
  const lines = wrapText(content, w - 6);
  console.log("  " + C.dim("╭") + C.dim("─".repeat(w - 2)) + C.dim("╮"));
  for (const line of lines) {
    console.log(
      "  " + C.dim("│") + "  " + pad(C.white90(line), w - 4) + C.dim("│")
    );
  }
  console.log("  " + C.dim("╰") + C.dim("─".repeat(w - 2)) + C.dim("╯"));
  console.log();
}

// ─── AI STREAM ────────────────────────────────────────────────────────────────
export function printStreamHeader(model?: string): void {
  const modelLabel = model
    ? model.length > 25
      ? model.slice(0, 22) + "…"
      : model
    : "AI";

  process.stdout.write("\n");
  process.stdout.write(
    "  " +
    chalk.bgHex("#2D1B69")(
      C.violet(" ") + C.violetBright(` ✦ ${modelLabel} `) + C.violet(" ")
    ) +
    "\n"
  );
  process.stdout.write(
    "  " + C.dim("╭") + C.violetDim("─".repeat(WIDTH - 2)) + C.dim("╮") + "\n"
  );
  process.stdout.write("  " + C.dim("│") + "  ");
}

export function printStreamChunk(chunk: string): void {
  process.stdout.write(C.white90(chunk));
}

export function printStreamEnd(): void {
  process.stdout.write(
    "\n  " + C.dim("╰") + C.violetDim("─".repeat(WIDTH - 2)) + C.dim("╯") + "\n\n"
  );
}

// ─── THINKING ────────────────────────────────────────────────────────────────
export function printThinking(model?: string): void {
  const label = model ? model.slice(0, 20) : "AI";
  process.stdout.write(
    "\n  " +
    chalk.bgHex("#0F0F14")(
      C.dim(" ╭") + C.dim("─".repeat(34)) + C.dim("╮ ")
    ) + "\n"
  );
  process.stdout.write(
    "  " +
    chalk.bgHex("#0F0F14")(
      C.dim(" │ ") +
      chalk.bgHex("#1A1A2E")(C.violet(` ✦ ${label} `)) +
      C.white40("  Thinking ") +
      C.violet("● ") +
      C.violetDim("● ") +
      C.dim("●  ") +
      C.dim(" │ ")
    ) + "\n"
  );
  process.stdout.write(
    "  " +
    chalk.bgHex("#0F0F14")(
      C.dim(" ╰") + C.dim("─".repeat(34)) + C.dim("╯ ")
    ) + "\n\n"
  );
}

// ─── ERROR ────────────────────────────────────────────────────────────────────
export function printError(message: string): void {
  const w = WIDTH;
  const lines = wrapText(message, w - 6);
  console.log();
  console.log(
    "  " + C.error("╭─ ✕ Error ") + C.error("─".repeat(w - 12)) + C.error("╮")
  );
  for (const line of lines) {
    console.log(
      "  " + C.error("│") + "  " + pad(chalk.hex("#FCA5A5")(line), w - 4) + C.error("│")
    );
  }
  console.log("  " + C.error("╰") + C.error("─".repeat(w - 2)) + C.error("╯"));
  console.log();
}

// ─── SUCCESS / INFO / WARNING ─────────────────────────────────────────────────
export function printSuccess(message: string): void {
  console.log(
    "  " + chalk.bgHex("#052E16")(C.success("  ✦ ")) + "  " + C.white90(message)
  );
}

export function printInfo(message: string): void {
  console.log("  " + C.violet("  ◈ ") + C.white40(message));
}

export function printWarning(message: string): void {
  console.log("  " + C.warning("  ⚠ ") + chalk.hex("#FCD34D")(message));
}

// ─── DIVIDERS ─────────────────────────────────────────────────────────────────
export function printDivider(): void {
  console.log("  " + C.dim("─".repeat(WIDTH)));
}

export function printThickDivider(): void {
  console.log(
    "  " +
    C.violetDim("─".repeat(Math.floor(WIDTH / 4))) +
    C.violet("─".repeat(Math.floor(WIDTH / 2))) +
    C.violetDim("─".repeat(Math.floor(WIDTH / 4)))
  );
}

// ─── HELP ─────────────────────────────────────────────────────────────────────
export function printHelp(): void {
  const w = WIDTH;

  const section = (title: string) => {
    console.log(
      "  " + C.dim("│") +
      pad(C.violetBright(`  ▸ ${title}`), w - 2) +
      C.dim("│")
    );
  };

  const row = (cmd: string, desc: string) => {
    console.log(
      "  " + C.dim("│") +
      pad("    " + C.violet(cmd.padEnd(24)) + C.white40(desc), w - 2) +
      C.dim("│")
    );
  };

  const divRow = () => {
    console.log(
      "  " + C.dim("│") +
      C.dim("  " + "·".repeat(w - 6)) + "  " +
      C.dim("│")
    );
  };

  console.log();
  console.log(
    "  " + C.dim("╭─ ") + C.violet("⌘ Commands ") + C.dim("─".repeat(w - 14)) + C.dim("╮")
  );

  section("Chat");
  row("/help  /h",          "Show this help");
  row("/clear /c",          "Clear conversation");
  row("/system <prompt>",   "Update system prompt");
  row("/tokens",            "Token usage stats");
  row("/retry",             "Retry last message");
  row("/save [file]",       "Save conversation");
  row("/exit /quit",        "Exit");
  divRow();

  section("Models");
  row("/model <name>",      "Switch model");
  row("/ormodel /orm",      "OpenRouter model switcher");
  row("/provider <name>",   "Switch provider");
  row("/models",            "List all models");
  divRow();

  section("Files — Auto-detected");
  row("fix <file>",         "AI reads + fixes automatically");
  row("fix everything",     "AI scans entire project");
  row("explain <file>",     "AI reads + explains");
  row("/read <file>",       "Display file in terminal");
  row("/ls [dir]",          "List directory");
  row("/tree [dir]",        "Directory tree");
  row("/search <query>",    "Search in project files");
  row("/write <f> <txt>",   "Create or overwrite file");
  row("/delete <file>",     "Delete file (with backup)");
  row("/savereply [file]",  "Save AI response to file");
  divRow();

  section("Attachments");
  row("/upload <path>",     "Upload file to AI");
  row("/paste-image",       "Paste image from clipboard");

  console.log(
    "  " + C.dim("╰") + C.dim("─".repeat(w)) + C.dim("╯")
  );
  console.log();
}

// ─── MODEL LIST ───────────────────────────────────────────────────────────────
export function printModelList(
  models: Record<string, Array<{ name: string; description?: string; size?: string }>>
): void {
  const w = WIDTH;
  console.log();
  console.log(
    "  " + C.dim("╭─ ") + C.violet("◈ Available Models ") + C.dim("─".repeat(w - 22)) + C.dim("╮")
  );

  for (const [provider, list] of Object.entries(models)) {
    console.log(
      "  " + C.dim("│") +
      pad(C.violetBright(`  ▸ ${provider.toUpperCase()}`), w - 2) +
      C.dim("│")
    );

    for (const m of list) {
      const nameShort = m.name.length > 32 ? m.name.slice(0, 29) + "…" : m.name;
      const right = m.description || m.size || "";
      console.log(
        "  " + C.dim("│") +
        pad(
          C.white40("    ◉ ") + C.white90(nameShort.padEnd(32)) + C.dim(right),
          w - 2
        ) +
        C.dim("│")
      );
    }

    console.log(
      "  " + C.dim("│") +
      C.dim("  " + "·".repeat(w - 6)) + "  " +
      C.dim("│")
    );
  }

  console.log("  " + C.dim("╰") + C.dim("─".repeat(w)) + C.dim("╯"));
  console.log();
}

// ─── CONFIG ───────────────────────────────────────────────────────────────────
export function printConfig(
  items: Array<{ key: string; value: string; sensitive?: boolean }>
): void {
  const w = WIDTH;
  console.log();
  console.log(
    "  " + C.dim("╭─ ") + C.violet("⚙ Configuration ") + C.dim("─".repeat(w - 19)) + C.dim("╮")
  );

  for (const item of items) {
    const val = item.sensitive
      ? item.value
        ? chalk.bgHex("#1A1A2E")(C.violet(" ●●●●●●●● ") + C.white40("(set)"))
        : C.dim("(not set)")
      : C.white90(item.value || "(empty)");

    console.log(
      "  " + C.dim("│") +
      "  " +
      C.white40(item.key.padEnd(22)) +
      pad(val, w - 26) +
      C.dim("│")
    );
  }

  console.log("  " + C.dim("╰") + C.dim("─".repeat(w)) + C.dim("╯"));
  console.log();
}

// ─── STATUS ───────────────────────────────────────────────────────────────────
export function printStatus(
  items: Array<{ label: string; value: string; ok: boolean }>
): void {
  const w = WIDTH;
  console.log();
  console.log(
    "  " + C.dim("╭─ ") + C.violet("◉ Status ") + C.dim("─".repeat(w - 12)) + C.dim("╮")
  );

  for (const item of items) {
    const dot = item.ok
      ? chalk.bgHex("#052E16")(C.success(" ● "))
      : chalk.bgHex("#1C0A00")(C.error(" ○ "));
    const label = C.white40(item.label.padEnd(22));
    const val = item.ok ? C.white90(item.value) : C.dim(item.value);

    console.log(
      "  " + C.dim("│") + "  " + dot + "  " + label + pad(val, w - 30) + C.dim("│")
    );
  }

  console.log("  " + C.dim("╰") + C.dim("─".repeat(w)) + C.dim("╯"));
  console.log();
}

// ─── FILE INFO ────────────────────────────────────────────────────────────────
export function printFileInfo(
  files: Array<{ name: string; type: string; size: number }>
): void {
  if (files.length === 0) return;
  const w = WIDTH;

  console.log(
    "  " + C.dim("╭─ ") + C.violet("⎙ Attachments ") + C.dim("─".repeat(w - 17)) + C.dim("╮")
  );
  for (const f of files) {
    const sizeStr = formatBytesDisplay(f.size);
    console.log(
      "  " + C.dim("│") +
      pad(C.violet("  ⎙ ") + C.white90(f.name) + C.dim(` (${f.type}, ${sizeStr})`), w - 2) +
      C.dim("│")
    );
  }
  console.log("  " + C.dim("╰") + C.dim("─".repeat(w)) + C.dim("╯"));
}

// ─── GOODBYE ─────────────────────────────────────────────────────────────────
export function printGoodbye(): void {
  const w = WIDTH;
  console.log();
  console.log("  " + C.dim("╭") + C.dim("─".repeat(w - 2)) + C.dim("╮"));
  console.log(
    "  " + C.dim("│") +
    center(C.violetBright("✦ ") + C.white90("Session ended") + C.violetBright(" ✦"), w - 2) +
    C.dim("│")
  );
  console.log(
    "  " + C.dim("│") +
    center(C.dim("Come back anytime"), w - 2) +
    C.dim("│")
  );
  console.log("  " + C.dim("╰") + C.dim("─".repeat(w - 2)) + C.dim("╯"));
  console.log();
}

// ─── INPUT BOX (used by SmartInput) ──────────────────────────────────────────
export function renderInputBox(buffer: string): string[] {
  const w = WIDTH;
  const lines: string[] = [];

  lines.push("  " + C.dim("╭") + C.dim("─".repeat(w - 2)) + C.dim("╮"));

  if (buffer.length === 0) {
    lines.push(
      "  " + C.dim("│") + "  " +
      pad(C.dim("Ask a question…  (/ for commands, Ctrl+C to exit)"), w - 4) +
      C.dim("│")
    );
  } else if (buffer === "/") {
    lines.push(
      "  " + C.dim("│") + "  " +
      pad(C.violet("/") + C.white40("  ↵ Enter to open menu · or keep typing…"), w - 4) +
      C.dim("│")
    );
  } else {
    const display = buffer.length > w - 8
      ? "…" + buffer.slice(-(w - 10))
      : buffer;
    lines.push(
      "  " + C.dim("│") + "  " +
      pad(C.white90(display) + C.violet("█"), w - 4) +
      C.dim("│")
    );
  }

  lines.push("  " + C.dim("├") + C.dim("─".repeat(w - 2)) + C.dim("┤"));
  lines.push(
    "  " + C.dim("│") +
    "  " +
    C.dim("⎙ /upload") +
    "   " +
    C.dim("⌘ /") +
    " ".repeat(Math.max(0, w - 22)) +
    chalk.bgHex("#1C1C21")(C.violet(" ↵ Send ")) +
    " " +
    C.dim("│")
  );
  lines.push("  " + C.dim("╰") + C.dim("─".repeat(w - 2)) + C.dim("╯"));

  return lines;
}

// ─── AGENT STATUS ─────────────────────────────────────────────────────────────
export function printAgentStatus(action: string, files?: string[]): void {
  console.log(
    "  " +
    chalk.bgHex("#1A1A2E")(
      C.violet(" ◈ ") +
      C.violetBright("Agent ") +
      C.white40(action) +
      (files && files.length > 0
        ? C.dim(` · ${files.length} file${files.length > 1 ? "s" : ""}`)
        : "")
    )
  );
  if (files && files.length > 0 && files.length <= 5) {
    for (const f of files) {
      console.log("    " + C.violet("  ·  ") + C.white40(f));
    }
  }
}

// ─── APPLY FIXES PROMPT ──────────────────────────────────────────────────────
export function printApplyFixesPrompt(): void {
  const w = WIDTH;
  console.log();
  console.log(
    "  " +
    chalk.bgHex("#1A1A2E")(
      C.violet(" ✦ ") +
      C.white90("AI has provided fixes") +
      C.white40("  Apply automatically?") +
      C.violet(" ✦ ")
    )
  );
  console.log(
    "  " + C.dim("╭─ ") + C.violetBright("Apply Fixes") + C.dim(" ─".repeat(Math.floor((w - 14) / 2))) + C.dim("╮")
  );
  console.log(
    "  " + C.dim("│") +
    pad("  " + C.white90("Y") + C.white40(" → Apply fixes automatically"), w - 2) +
    C.dim("│")
  );
  console.log(
    "  " + C.dim("│") +
    pad("  " + C.white90("N") + C.white40(" → Skip — copy code manually from above"), w - 2) +
    C.dim("│")
  );
  console.log("  " + C.dim("╰") + C.dim("─".repeat(w)) + C.dim("╯"));
}

// ─── COMMAND SUGGESTIONS ──────────────────────────────────────────────────────
export function printCommandSuggestions(): void {
  console.log();
  const buttons = [
    { icon: "◈", label: "Switch Model", cmd: "/ormodel" },
    { icon: "⎙",  label: "Upload File",  cmd: "/upload"  },
    { icon: "↺",  label: "Retry",        cmd: "/retry"   },
    { icon: "⬇",  label: "Save Chat",    cmd: "/save"    },
  ];

  const row = buttons
    .map((b) =>
      chalk.bgHex("#111113")(
        C.violet(` ${b.icon} `) +
        C.white40(`${b.label} `) +
        C.dim(`[${b.cmd}] `)
      )
    )
    .join(C.dim("  "));

  console.log("  " + row);
  console.log();
}
