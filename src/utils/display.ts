import chalk from "chalk";

// ─── Theme Colors ────────────────────────────────────────────────────────────
export const C = {
  red: chalk.hex("#FF2222"),
  redBright: chalk.hex("#FF5555"),
  redDim: chalk.hex("#991111"),
  redDark: chalk.hex("#330000"),
  white: chalk.hex("#FFFFFF"),
  whiteDim: chalk.hex("#CCCCCC"),
  gray: chalk.hex("#666666"),
  grayDark: chalk.hex("#444444"),
  bgBlack: chalk.bgHex("#0A0A0A"),
  redBg: chalk.bgHex("#FF2222"),
  selectedBg: chalk.bgHex("#FF2222"),
};

const BOX_WIDTH = 54; // inner content width

function padRight(str: string, width: number): string {
  const visibleLen = stripAnsi(str).length;
  const pad = Math.max(0, width - visibleLen);
  return str + " ".repeat(pad);
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*m/g, "").replace(/\x1B\[\d+[A-Z]/g, "");
}

function centerText(text: string, width: number): string {
  const len = stripAnsi(text).length;
  const total = Math.max(0, width - len);
  const left = Math.floor(total / 2);
  const right = total - left;
  return " ".repeat(left) + text + " ".repeat(right);
}

// ─── Banner ──────────────────────────────────────────────────────────────────
export function printCleanBanner(): void {
  const w = BOX_WIDTH;
  console.log(C.red("╔" + "═".repeat(w) + "╗"));
  console.log(C.red("║") + " ".repeat(w) + C.red("║"));
  console.log(
    C.red("║") +
      centerText(
        C.redBright("▀▄▀▄▀ ") +
          C.white("PM CLI") +
          C.whiteDim(" v1.0.0") +
          C.redBright(" ▀▄▀▄▀"),
        w
      ) +
      C.red("║")
  );
  console.log(
    C.red("║") +
      centerText(C.whiteDim("Universal AI Terminal · All Models"), w) +
      C.red("║")
  );
  console.log(C.red("║") + " ".repeat(w) + C.red("║"));
  console.log(C.red("╚" + "═".repeat(w) + "╝"));
  console.log();
}

// ─── Session Header ──────────────────────────────────────────────────────────
export function printHeader(provider: string, model: string): void {
  const w = BOX_WIDTH;
  const provLine = `  Provider : ${provider}`;
  const modLine = `  Model    : ${model}`;
  const tipLine = `  Tip      : type / + Enter for menu`;
  console.log(C.redDim("┌─ SESSION " + "─".repeat(w - 10) + "┐"));
  console.log(
    C.redDim("│") + padRight(C.whiteDim(provLine), w) + C.redDim("│")
  );
  console.log(
    C.redDim("│") + padRight(C.whiteDim(modLine), w) + C.redDim("│")
  );
  console.log(
    C.redDim("│") + padRight(C.gray(tipLine), w) + C.redDim("│")
  );
  console.log(C.redDim("└" + "─".repeat(w) + "┘"));
  console.log();
}

// ─── User Message ────────────────────────────────────────────────────────────
export function printUserMessage(content: string, hasFiles?: boolean): void {
  console.log();
  console.log(C.red("╔═ YOU") + (hasFiles ? C.redDim(" [+files]") : "") + C.red(" ═╗"));
  console.log(C.red("╚" + "═".repeat(hasFiles ? 16 : 7) + "╝"));
  console.log(C.white(content));
  console.log();
}

// ─── AI Stream ───────────────────────────────────────────────────────────────
export function printStreamHeader(model?: string): void {
  const label = model ? `══ AI (${model})` : "══ AI";
  process.stdout.write(C.red("╔" + label + " ══╗") + "\n");
  process.stdout.write(C.red("╚" + "═".repeat(stripAnsi(label).length + 2) + "╝") + "\n");
}

export function printStreamChunk(chunk: string): void {
  process.stdout.write(C.white(chunk));
}

export function printStreamEnd(): void {
  process.stdout.write("\n\n");
}

// ─── Error ───────────────────────────────────────────────────────────────────
export function printError(message: string): void {
  const w = BOX_WIDTH;
  console.log();
  console.log(C.red("╔═ ERROR " + "═".repeat(w - 8) + "╗"));
  const lines = wrapText(message, w - 2);
  for (const line of lines) {
    console.log(
      C.red("║ ") + padRight(C.redBright(line), w - 2) + C.red(" ║")
    );
  }
  console.log(C.red("╚" + "═".repeat(w) + "╝"));
  console.log();
}

// ─── Success / Info / Warning ─────────────────────────────────────────────────
export function printSuccess(message: string): void {
  console.log(C.red("  ✦ ") + C.white(message));
}

export function printInfo(message: string): void {
  console.log(C.redDim("  ◈ ") + C.whiteDim(message));
}

export function printWarning(message: string): void {
  console.log(C.redBright("  ⚠ ") + C.redBright(message));
}

// ─── Dividers ─────────────────────────────────────────────────────────────────
export function printDivider(): void {
  console.log(C.redDim("─".repeat(50)));
}

export function printThickDivider(): void {
  console.log(C.red("═".repeat(50)));
}

// ─── Help ─────────────────────────────────────────────────────────────────────
export function printHelp(): void {
  const w = BOX_WIDTH;
  const line = (label: string, desc: string) => {
    const full = `  ${label.padEnd(22)} ${desc}`;
    console.log(
      C.red("║") + padRight(C.whiteDim(full), w) + C.red("║")
    );
  };
  const header = (title: string) => {
    console.log(
      C.red("║") + padRight(C.red(`  ── ${title}`), w) + C.red("║")
    );
  };
  console.log(C.red("╔══ HELP " + "═".repeat(w - 8) + "╗"));
  header("Slash Commands");
  line("/", "Open interactive menu");
  line("/help  /h", "Show this help");
  line("/model <name>", "Switch model");
  line("/clear /c", "Clear conversation history");
  line("/system <prompt>", "Update system prompt");
  line("/save [file]", "Save conversation to file");
  line("/tokens", "Show token usage stats");
  line("/retry", "Retry last message");
  line("/models", "List all available models");
  line("/paste-image", "Paste image from clipboard");
  line("/upload <path>", "Upload a file (image/pdf/docx/xlsx/zip/...)");
  line("/exit /quit /q", "Exit the CLI");
  header("File Uploads");
  line("Images", ".jpg .png .gif .webp .bmp .svg");
  line("Documents", ".pdf .docx .txt .md .csv");
  line("Spreadsheets", ".xlsx .xls .ods");
  line("Archives", ".zip (shows file listing)");
  line("Code files", ".js .ts .py .go .rs .java + more");
  header("Keyboard");
  line("/ + Enter", "Open menu");
  line("Ctrl+C", "Exit");
  line("Esc", "Clear input buffer");
  console.log(C.red("╚" + "═".repeat(w) + "╝"));
  console.log();
}

// ─── Model List ───────────────────────────────────────────────────────────────
export function printModelList(
  models: Record<string, Array<{ name: string; description?: string; size?: string }>>
): void {
  const w = BOX_WIDTH;
  console.log(C.red("╔══ AVAILABLE MODELS " + "═".repeat(w - 20) + "╗"));
  for (const [provider, list] of Object.entries(models)) {
    console.log(
      C.red("╠══") + C.red(` ${provider.toUpperCase()} `) + C.red("═".repeat(Math.max(0, w - provider.length - 5))) + C.red("╣")
    );
    for (const m of list) {
      const left = `  ◉ ${m.name}`;
      const right = m.description || m.size || "";
      const gap = w - stripAnsi(left).length - right.length - 2;
      const row =
        C.whiteDim(left) +
        " ".repeat(Math.max(1, gap)) +
        C.gray(right);
      console.log(C.red("║") + padRight(row, w) + C.red("║"));
    }
  }
  console.log(C.red("╚" + "═".repeat(w) + "╝"));
  console.log();
}

// ─── Config Panel ─────────────────────────────────────────────────────────────
export function printConfig(
  items: Array<{ key: string; value: string; sensitive?: boolean }>
): void {
  const w = BOX_WIDTH;
  console.log(C.red("╔══ CONFIGURATION " + "═".repeat(w - 17) + "╗"));
  for (const item of items) {
    const val = item.sensitive
      ? item.value
        ? C.gray("●●●●●●●● (set)")
        : C.gray("(not set)")
      : C.white(item.value);
    const label = `  ${item.key.padEnd(22)}`;
    console.log(
      C.red("║") +
        C.redDim(label) +
        padRight(val, w - label.length) +
        C.red("║")
    );
  }
  console.log(C.red("╚" + "═".repeat(w) + "╝"));
  console.log();
}

// ─── Status Panel ─────────────────────────────────────────────────────────────
export function printStatus(
  items: Array<{ label: string; value: string; ok: boolean }>
): void {
  const w = BOX_WIDTH;
  console.log(C.red("╔══ STATUS " + "═".repeat(w - 10) + "╗"));
  for (const item of items) {
    const dot = item.ok ? C.red("● ") : C.gray("○ ");
    const label = item.label.padEnd(22);
    const val = item.ok ? C.white(item.value) : C.gray(item.value);
    console.log(
      C.red("║  ") + dot + C.whiteDim(label) + padRight(val, w - 27) + C.red("║")
    );
  }
  console.log(C.red("╚" + "═".repeat(w) + "╝"));
  console.log();
}

// ─── File Upload Info ─────────────────────────────────────────────────────────
export function printFileInfo(
  files: Array<{ name: string; type: string; size: number }>
): void {
  const w = BOX_WIDTH;
  if (files.length === 0) return;
  console.log(C.redDim("┌─ ATTACHMENTS " + "─".repeat(w - 14) + "┐"));
  for (const f of files) {
    const sizeStr = formatBytes(f.size);
    const line = `  📎 ${f.name}  (${f.type}, ${sizeStr})`;
    console.log(C.redDim("│") + padRight(C.whiteDim(line), w) + C.redDim("│"));
  }
  console.log(C.redDim("└" + "─".repeat(w) + "┘"));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ─── Wrap text ────────────────────────────────────────────────────────────────
function wrapText(text: string, width: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length + word.length + 1 > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ─── Goodbye ─────────────────────────────────────────────────────────────────
export function printGoodbye(): void {
  const w = BOX_WIDTH;
  console.log();
  console.log(C.red("╔" + "═".repeat(w) + "╗"));
  console.log(
    C.red("║") + centerText(C.white("Session ended. Goodbye! ✦"), w) + C.red("║")
  );
  console.log(C.red("╚" + "═".repeat(w) + "╝"));
  console.log();
}