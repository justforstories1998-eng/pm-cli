import chalk from "chalk";
import { getOllamaModels } from "../models/ollama";
import { GROQ_MODELS } from "../models/groq";
import { OPENROUTER_MODELS } from "../models/openrouter";
import { GOOGLE_MODELS } from "../models/google";
import { KIMI_MODELS } from "../models/kimi";
import { MINIMAX_MODELS } from "../models/minimax";
import { DEEPSEEK_MODELS } from "../models/deepseek";

export type Provider =
  | "ollama"
  | "groq"
  | "openrouter"
  | "google"
  | "kimi"
  | "minimax"
  | "deepseek";

export interface MenuItem {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: string;
  isHeader?: boolean;
}

// ─── ANSI helpers ────────────────────────────────────────────────────────────
const ESC = "\x1B";
const CLEAR_LINE = `${ESC}[2K`;
const CURSOR_UP = `${ESC}[1A`;
const CURSOR_HIDE = `${ESC}[?25l`;
const CURSOR_SHOW = `${ESC}[?25h`;
const CURSOR_COL0 = `${ESC}[G`;

function moveCursorUp(n: number): string {
  return n > 0 ? `${ESC}[${n}A` : "";
}

function clearLines(n: number): void {
  for (let i = 0; i < n; i++) {
    process.stdout.write(CURSOR_UP + CLEAR_LINE);
  }
  process.stdout.write(CURSOR_COL0);
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1B\[[0-9;]*m/g, "").replace(/\x1B\[\d+[A-Z]/g, "");
}

function padRight(s: string, w: number): string {
  const len = stripAnsi(s).length;
  return s + " ".repeat(Math.max(0, w - len));
}

const C = {
  red: chalk.hex("#FF2222"),
  redBright: chalk.hex("#FF5555"),
  redDim: chalk.hex("#991111"),
  white: chalk.hex("#FFFFFF"),
  whiteDim: chalk.hex("#CCCCCC"),
  gray: chalk.hex("#666666"),
  selectedBg: chalk.bgHex("#FF2222").hex("#FFFFFF"),
  headerColor: chalk.hex("#FF2222"),
};

const BOX_W = 54;

// ─── Menu Items ───────────────────────────────────────────────────────────────
const ALL_MENU_ITEMS: MenuItem[] = [
  // Models category
  {
    id: "__cat_models",
    label: "Models",
    description: "",
    icon: "",
    category: "Models",
    isHeader: true,
  },
  {
    id: "switch-model",
    label: "Switch Model",
    description: "Change the AI model",
    icon: "◈",
    category: "Models",
  },
  {
    id: "list-models",
    label: "List All Models",
    description: "Browse all models by provider",
    icon: "◉",
    category: "Models",
  },
  {
    id: "pull-model",
    label: "Pull Ollama Model",
    description: "Download a model locally",
    icon: "⊕",
    category: "Models",
  },
  // Session category
  {
    id: "__cat_session",
    label: "Session",
    description: "",
    icon: "",
    category: "Session",
    isHeader: true,
  },
  {
    id: "clear",
    label: "Clear History",
    description: "Wipe conversation, start fresh",
    icon: "✕",
    category: "Session",
  },
  {
    id: "system-prompt",
    label: "System Prompt",
    description: "Update AI personality",
    icon: "❯",
    category: "Session",
  },
  {
    id: "tokens",
    label: "Token Usage",
    description: "Show tokens used this session",
    icon: "◷",
    category: "Session",
  },
  {
    id: "retry",
    label: "Retry Last Message",
    description: "Re-send your last message",
    icon: "↺",
    category: "Session",
  },
  // Files category
  {
    id: "__cat_files",
    label: "Files",
    description: "",
    icon: "",
    category: "Files",
    isHeader: true,
  },
  {
    id: "paste-image",
    label: "Paste Image",
    description: "Paste image from clipboard",
    icon: "⎙",
    category: "Files",
  },
  {
    id: "upload-file",
    label: "Upload File",
    description: "Upload pdf/docx/xlsx/zip/image/code...",
    icon: "↑",
    category: "Files",
  },
  // Output category
  {
    id: "__cat_output",
    label: "Output",
    description: "",
    icon: "",
    category: "Output",
    isHeader: true,
  },
  {
    id: "save",
    label: "Save Conversation",
    description: "Export chat to a text file",
    icon: "⬇",
    category: "Output",
  },
  {
    id: "copy-last",
    label: "Copy Last Response",
    description: "Copy AI reply to clipboard",
    icon: "⎘",
    category: "Output",
  },
  // Settings category
  {
    id: "__cat_settings",
    label: "Settings",
    description: "",
    icon: "",
    category: "Settings",
    isHeader: true,
  },
  {
    id: "config",
    label: "Configuration",
    description: "View and change CLI settings",
    icon: "⚙",
    category: "Settings",
  },
  {
    id: "switch-provider",
    label: "Switch Provider",
    description: "Change between providers",
    icon: "⇄",
    category: "Settings",
  },
  {
    id: "stream-toggle",
    label: "Toggle Streaming",
    description: "Turn streaming on or off",
    icon: "≋",
    category: "Settings",
  },
  // Help
  {
    id: "__cat_help",
    label: "Help",
    description: "",
    icon: "",
    category: "Help",
    isHeader: true,
  },
  {
    id: "help",
    label: "Help",
    description: "Show all commands",
    icon: "?",
    category: "Help",
  },
  {
    id: "exit",
    label: "Exit",
    description: "End session and close CLI",
    icon: "✕",
    category: "Help",
  },
];

// ─── InteractiveMenu ──────────────────────────────────────────────────────────
export class InteractiveMenu {
  private selectedIndex = 0;
  private filterText = "";
  private filteredItems: MenuItem[] = [];
  private scrollOffset = 0;
  private readonly VISIBLE = 10;
  private lastRenderedLines = 0;
  private resolve!: (item: MenuItem | null) => void;

  async show(): Promise<MenuItem | null> {
    this.filterText = "";
    this.filteredItems = this.applyFilter();
    this.selectedIndex = this.firstSelectableIndex();
    this.scrollOffset = 0;
    this.lastRenderedLines = 0;

    return new Promise<MenuItem | null>((res) => {
      this.resolve = res;
      process.stdout.write(CURSOR_HIDE);
      this.render();
      this.attachKeys();
    });
  }

  private applyFilter(): MenuItem[] {
    if (!this.filterText) return ALL_MENU_ITEMS;
    const q = this.filterText.toLowerCase();
    const result: MenuItem[] = [];
    for (const item of ALL_MENU_ITEMS) {
      if (item.isHeader) continue;
      if (
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
      ) {
        result.push(item);
      }
    }
    return result;
  }

  private firstSelectableIndex(): number {
    for (let i = 0; i < this.filteredItems.length; i++) {
      if (!this.filteredItems[i].isHeader) return i;
    }
    return 0;
  }

  private render(): void {
    const lines: string[] = [];
    const w = BOX_W;
    const filterDisplay = this.filterText || "type to filter…";
    const filterColored = this.filterText
      ? C.white(this.filterText)
      : C.gray("type to filter…");

    lines.push(C.red("╔══ MENU " + "═".repeat(w - 8) + "╗"));
    lines.push(
      C.red("║") +
        padRight(C.redDim("  ⌕ ") + filterColored, w) +
        C.red("║")
    );
    lines.push(C.red("╠" + "═".repeat(w) + "╣"));

    const visibleItems = this.filteredItems.slice(
      this.scrollOffset,
      this.scrollOffset + this.VISIBLE
    );

    if (visibleItems.length === 0) {
      lines.push(
        C.red("║") +
          padRight(C.gray("  No results for: " + this.filterText), w) +
          C.red("║")
      );
    } else {
      for (let i = 0; i < visibleItems.length; i++) {
        const item = visibleItems[i];
        const actualIndex = i + this.scrollOffset;

        if (item.isHeader) {
          const headerLine = `  ▸ ${item.label}`;
          lines.push(
            C.red("║") +
              padRight(C.red(headerLine) + C.redDim("─".repeat(Math.max(0, w - headerLine.length - 2))), w) +
              C.red("║")
          );
        } else {
          const isSelected = actualIndex === this.selectedIndex;
          const icon = item.icon || "·";
          const rowContent = `  ${icon} ${item.label.padEnd(20)} ${item.description}`;

          if (isSelected) {
            lines.push(
              C.red("║") +
                C.selectedBg(padRight(rowContent, w)) +
                C.red("║")
            );
          } else {
            lines.push(
              C.red("║") +
                padRight(C.whiteDim(`  ${icon} `) + C.white(item.label.padEnd(20)) + C.gray(item.description), w) +
                C.red("║")
            );
          }
        }
      }
    }

    // Scroll indicator
    const total = this.filteredItems.filter((x) => !x.isHeader).length;
    const showing = Math.min(this.VISIBLE, visibleItems.filter((x) => !x.isHeader).length);
    if (total > this.VISIBLE) {
      const scrollInfo = `  ${showing}/${total} ↑↓ scroll`;
      lines.push(
        C.red("║") + padRight(C.gray(scrollInfo), w) + C.red("║")
      );
    }

    lines.push(C.red("╠" + "═".repeat(w) + "╣"));
    lines.push(
      C.red("║") +
        padRight(C.gray("  ↑↓ navigate · Enter select · Esc cancel · A-Z filter"), w) +
        C.red("║")
    );
    lines.push(C.red("╚" + "═".repeat(w) + "╝"));

    if (this.lastRenderedLines > 0) {
      clearLines(this.lastRenderedLines);
    }

    for (const line of lines) {
      process.stdout.write(line + "\n");
    }
    this.lastRenderedLines = lines.length;
  }

  private keyHandler!: (chunk: Buffer) => void;

  private attachKeys(): void {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      this.cleanup();
      this.resolve(null);
      return;
    }
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    this.keyHandler = (chunk: Buffer) => {
      const key = chunk.toString();
      this.handleKey(key);
    };

    (stdin as NodeJS.ReadStream).on("data", this.keyHandler);
  }

  private handleKey(key: string): void {
    if (key === "\x03") {
      this.cleanup();
      process.exit(0);
    }
    if (key === "\x1B") {
      this.cleanup();
      this.resolve(null);
      return;
    }
    if (key === "\r" || key === "\n") {
      const selected = this.filteredItems[this.selectedIndex];
      if (selected && !selected.isHeader) {
        this.cleanup();
        this.resolve(selected);
      }
      return;
    }
    // Arrow up
    if (key === "\x1B[A") {
      this.moveSelection(-1);
      this.render();
      return;
    }
    // Arrow down
    if (key === "\x1B[B") {
      this.moveSelection(1);
      this.render();
      return;
    }
    // Page up
    if (key === "\x1B[5~") {
      this.moveSelection(-this.VISIBLE);
      this.render();
      return;
    }
    // Page down
    if (key === "\x1B[6~") {
      this.moveSelection(this.VISIBLE);
      this.render();
      return;
    }
    // Backspace
    if (key === "\x7F" || key === "\b") {
      this.filterText = this.filterText.slice(0, -1);
      this.rebuildFilter();
      return;
    }
    // Printable chars
    if (key.length === 1 && key >= " ") {
      this.filterText += key;
      this.rebuildFilter();
      return;
    }
  }

  private rebuildFilter(): void {
    this.filteredItems = this.applyFilter();
    this.selectedIndex = this.firstSelectableIndex();
    this.scrollOffset = 0;
    this.render();
  }

  private moveSelection(delta: number): void {
    const selectables = this.filteredItems
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => !item.isHeader);

    if (selectables.length === 0) return;

    const currentPos = selectables.findIndex(
      ({ i }) => i === this.selectedIndex
    );
    const nextPos = Math.max(
      0,
      Math.min(selectables.length - 1, currentPos + delta)
    );
    this.selectedIndex = selectables[nextPos].i;

    // Adjust scroll
    if (this.selectedIndex < this.scrollOffset) {
      this.scrollOffset = this.selectedIndex;
    }
    if (this.selectedIndex >= this.scrollOffset + this.VISIBLE) {
      this.scrollOffset = this.selectedIndex - this.VISIBLE + 1;
    }
  }

  private cleanup(): void {
    if (process.stdin.isTTY) {
      try {
        (process.stdin as NodeJS.ReadStream).removeListener(
          "data",
          this.keyHandler
        );
        process.stdin.setRawMode(false);
        process.stdin.pause();
      } catch (_) {}
    }
    process.stdout.write(CURSOR_SHOW);
    if (this.lastRenderedLines > 0) {
      clearLines(this.lastRenderedLines);
    }
  }
}

// ─── ModelPickerMenu ──────────────────────────────────────────────────────────
export interface ModelChoice {
  provider: Provider;
  model: string;
  description?: string;
}

export class ModelPickerMenu {
  private selectedIndex = 0;
  private items: Array<
    | { isHeader: true; label: string }
    | { isHeader: false; provider: Provider; model: string; description: string }
  > = [];
  private lastRenderedLines = 0;
  private resolve!: (choice: ModelChoice | null) => void;
  private keyHandler!: (chunk: Buffer) => void;

  async show(): Promise<ModelChoice | null> {
    this.items = await this.buildItems();
    this.selectedIndex = this.firstSelectable();
    this.lastRenderedLines = 0;

    return new Promise<ModelChoice | null>((res) => {
      this.resolve = res;
      process.stdout.write(CURSOR_HIDE);
      this.render();
      this.attachKeys();
    });
  }

  private async buildItems(): Promise<typeof this.items> {
    const result: typeof this.items = [];

    // Ollama
    result.push({ isHeader: true, label: "OLLAMA (local)" });
    try {
      const ollamaModels = await getOllamaModels();
      if (ollamaModels.length === 0) {
        result.push({
          isHeader: false,
          provider: "ollama",
          model: "llama3.2",
          description: "default (not installed)",
        });
      } else {
        for (const m of ollamaModels) {
          result.push({
            isHeader: false,
            provider: "ollama",
            model: m.name,
            description: m.size || "local",
          });
        }
      }
    } catch {
      result.push({
        isHeader: false,
        provider: "ollama",
        model: "llama3.2",
        description: "Ollama not running",
      });
    }

    // Groq
    result.push({ isHeader: true, label: "GROQ (free cloud · fast)" });
    for (const m of GROQ_MODELS) {
      result.push({
        isHeader: false,
        provider: "groq",
        model: m.id,
        description: m.description,
      });
    }

    // OpenRouter
    result.push({ isHeader: true, label: "OPENROUTER (free cloud)" });
    for (const m of OPENROUTER_MODELS) {
      result.push({
        isHeader: false,
        provider: "openrouter",
        model: m.id,
        description: m.description,
      });
    }

    // Google
    result.push({ isHeader: true, label: "GOOGLE GEMINI (free tier)" });
    for (const m of GOOGLE_MODELS) {
      result.push({
        isHeader: false,
        provider: "google",
        model: m.id,
        description: m.description,
      });
    }

    // Kimi
    result.push({ isHeader: true, label: "KIMI (Moonshot AI)" });
    for (const m of KIMI_MODELS) {
      result.push({
        isHeader: false,
        provider: "kimi",
        model: m.id,
        description: m.description,
      });
    }

    // MiniMax
    result.push({ isHeader: true, label: "MINIMAX" });
    for (const m of MINIMAX_MODELS) {
      result.push({
        isHeader: false,
        provider: "minimax",
        model: m.id,
        description: m.description,
      });
    }

    // DeepSeek
    result.push({ isHeader: true, label: "DEEPSEEK" });
    for (const m of DEEPSEEK_MODELS) {
      result.push({
        isHeader: false,
        provider: "deepseek",
        model: m.id,
        description: m.description,
      });
    }

    return result;
  }

  private firstSelectable(): number {
    for (let i = 0; i < this.items.length; i++) {
      if (!this.items[i].isHeader) return i;
    }
    return 0;
  }

  private scrollOffset = 0;
  private readonly VISIBLE = 12;

  private render(): void {
    const w = BOX_W;
    const lines: string[] = [];
    lines.push(C.red("╔══ SELECT MODEL " + "═".repeat(w - 16) + "╗"));
    lines.push(
      C.red("║") +
        padRight(C.gray("  ↑↓ navigate · Enter select · Esc cancel"), w) +
        C.red("║")
    );
    lines.push(C.red("╠" + "═".repeat(w) + "╣"));

    const visible = this.items.slice(
      this.scrollOffset,
      this.scrollOffset + this.VISIBLE
    );

    for (let i = 0; i < visible.length; i++) {
      const item = visible[i];
      const actualIndex = i + this.scrollOffset;

      if (item.isHeader) {
        lines.push(
          C.red("║") +
            padRight(C.red(`  ${item.label}`), w) +
            C.red("║")
        );
      } else {
        const isSelected = actualIndex === this.selectedIndex;
        const desc = item.description || "";
        const row = `  ❯ ${item.model.padEnd(30)} ${desc}`;
        if (isSelected) {
          lines.push(
            C.red("║") + C.selectedBg(padRight(row, w)) + C.red("║")
          );
        } else {
          lines.push(
            C.red("║") +
              padRight(
                C.redDim("  · ") + C.white(item.model.padEnd(30)) + C.gray(desc),
                w
              ) +
              C.red("║")
          );
        }
      }
    }

    lines.push(C.red("╚" + "═".repeat(w) + "╝"));

    if (this.lastRenderedLines > 0) {
      clearLines(this.lastRenderedLines);
    }
    for (const line of lines) {
      process.stdout.write(line + "\n");
    }
    this.lastRenderedLines = lines.length;
  }

  private attachKeys(): void {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      this.cleanup();
      this.resolve(null);
      return;
    }
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    this.keyHandler = (chunk: Buffer) => {
      const key = chunk.toString();
      if (key === "\x03") {
        this.cleanup();
        process.exit(0);
      }
      if (key === "\x1B") {
        this.cleanup();
        this.resolve(null);
        return;
      }
      if (key === "\r" || key === "\n") {
        const item = this.items[this.selectedIndex];
        if (item && !item.isHeader) {
          this.cleanup();
          this.resolve({
            provider: item.provider,
            model: item.model,
            description: item.description,
          });
        }
        return;
      }
      if (key === "\x1B[A") {
        this.moveSelection(-1);
        this.render();
        return;
      }
      if (key === "\x1B[B") {
        this.moveSelection(1);
        this.render();
        return;
      }
    };
    (stdin as NodeJS.ReadStream).on("data", this.keyHandler);
  }

  private moveSelection(delta: number): void {
    const selectables = this.items
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => !item.isHeader);

    if (selectables.length === 0) return;
    const cur = selectables.findIndex(({ i }) => i === this.selectedIndex);
    const next = Math.max(0, Math.min(selectables.length - 1, cur + delta));
    this.selectedIndex = selectables[next].i;

    if (this.selectedIndex < this.scrollOffset)
      this.scrollOffset = this.selectedIndex;
    if (this.selectedIndex >= this.scrollOffset + this.VISIBLE)
      this.scrollOffset = this.selectedIndex - this.VISIBLE + 1;
  }

  private cleanup(): void {
    if (process.stdin.isTTY) {
      try {
        (process.stdin as NodeJS.ReadStream).removeListener(
          "data",
          this.keyHandler
        );
        process.stdin.setRawMode(false);
        process.stdin.pause();
      } catch (_) {}
    }
    process.stdout.write(CURSOR_SHOW);
    if (this.lastRenderedLines > 0) clearLines(this.lastRenderedLines);
  }
}

// ─── ProviderPickerMenu ───────────────────────────────────────────────────────
const PROVIDERS: Array<{
  id: Provider;
  name: string;
  description: string;
  icon: string;
}> = [
  { id: "ollama", name: "Ollama", description: "Local models, always free", icon: "◉" },
  { id: "groq", name: "Groq", description: "Fastest free cloud inference", icon: "◈" },
  { id: "openrouter", name: "OpenRouter", description: "Most free models available", icon: "❯" },
  { id: "google", name: "Google Gemini", description: "Google free tier", icon: "✦" },
  { id: "kimi", name: "Kimi (Moonshot)", description: "Kimi k2.6 and more", icon: "◈" },
  { id: "minimax", name: "MiniMax", description: "MiniMax 2.5 and more", icon: "◉" },
  { id: "deepseek", name: "DeepSeek", description: "DeepSeek R2 and more", icon: "❯" },
];

export class ProviderPickerMenu {
  private selectedIndex = 0;
  private lastRenderedLines = 0;
  private resolve!: (provider: Provider | null) => void;
  private keyHandler!: (chunk: Buffer) => void;

  async show(): Promise<Provider | null> {
    this.selectedIndex = 0;
    this.lastRenderedLines = 0;

    return new Promise<Provider | null>((res) => {
      this.resolve = res;
      process.stdout.write(CURSOR_HIDE);
      this.render();
      this.attachKeys();
    });
  }

  private render(): void {
    const w = BOX_W;
    const lines: string[] = [];
    lines.push(C.red("╔══ SELECT PROVIDER " + "═".repeat(w - 19) + "╗"));
    lines.push(
      C.red("║") +
        padRight(C.gray("  ↑↓ navigate · Enter select · Esc cancel"), w) +
        C.red("║")
    );
    lines.push(C.red("╠" + "═".repeat(w) + "╣"));

    for (let i = 0; i < PROVIDERS.length; i++) {
      const p = PROVIDERS[i];
      const isSelected = i === this.selectedIndex;
      const row = `  ${p.icon} ${p.name.padEnd(18)} ${p.description}`;
      if (isSelected) {
        lines.push(
          C.red("║") + C.selectedBg(padRight(row, w)) + C.red("║")
        );
      } else {
        lines.push(
          C.red("║") +
            padRight(
              C.redDim(`  ${p.icon} `) +
                C.white(p.name.padEnd(18)) +
                C.gray(p.description),
              w
            ) +
            C.red("║")
        );
      }
    }

    lines.push(C.red("╚" + "═".repeat(w) + "╝"));

    if (this.lastRenderedLines > 0) clearLines(this.lastRenderedLines);
    for (const line of lines) {
      process.stdout.write(line + "\n");
    }
    this.lastRenderedLines = lines.length;
  }

  private attachKeys(): void {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      this.cleanup();
      this.resolve(null);
      return;
    }
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    this.keyHandler = (chunk: Buffer) => {
      const key = chunk.toString();
      if (key === "\x03") {
        this.cleanup();
        process.exit(0);
      }
      if (key === "\x1B") {
        this.cleanup();
        this.resolve(null);
        return;
      }
      if (key === "\r" || key === "\n") {
        this.cleanup();
        this.resolve(PROVIDERS[this.selectedIndex].id);
        return;
      }
      if (key === "\x1B[A") {
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        this.render();
        return;
      }
      if (key === "\x1B[B") {
        this.selectedIndex = Math.min(
          PROVIDERS.length - 1,
          this.selectedIndex + 1
        );
        this.render();
        return;
      }
    };
    (stdin as NodeJS.ReadStream).on("data", this.keyHandler);
  }

  private cleanup(): void {
    if (process.stdin.isTTY) {
      try {
        (process.stdin as NodeJS.ReadStream).removeListener(
          "data",
          this.keyHandler
        );
        process.stdin.setRawMode(false);
        process.stdin.pause();
      } catch (_) {}
    }
    process.stdout.write(CURSOR_SHOW);
    if (this.lastRenderedLines > 0) clearLines(this.lastRenderedLines);
  }
}