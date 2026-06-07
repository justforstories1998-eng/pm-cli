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

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const CURSOR_HIDE = "\x1B[?25l";
const CURSOR_SHOW = "\x1B[?25h";
const CURSOR_UP   = "\x1B[1A";
const CLEAR_LINE  = "\x1B[2K";
const CURSOR_COL0 = "\x1B[G";

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

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  violet:       chalk.hex("#8B5CF6"),
  violetBright: chalk.hex("#A78BFA"),
  violetDim:    chalk.hex("#4C1D95"),
  white:        chalk.hex("#F0F0F0"),
  white90:      chalk.hex("#E6E6E6"),
  whiteDim:     chalk.hex("#A0A0A0"),
  gray:         chalk.hex("#555560"),
  dim:          chalk.hex("#444449"),
  selectedBg:   chalk.bgHex("#2D1B69").hex("#E0D7FF"),
  error:        chalk.hex("#EF4444"),
  success:      chalk.hex("#10B981"),
};

const BOX_W = 60;

// ─── Menu Items ───────────────────────────────────────────────────────────────
const ALL_MENU_ITEMS: MenuItem[] = [
  // Models
  { id: "__cat_models",    label: "Models",            description: "",                              icon: "", category: "Models",   isHeader: true },
  { id: "switch-model",    label: "Switch Model",      description: "Change the AI model",           icon: "◈", category: "Models" },
  { id: "list-models",     label: "List All Models",   description: "Browse all models by provider", icon: "◉", category: "Models" },
  { id: "pull-model",      label: "Pull Ollama Model", description: "Download a model locally",      icon: "⊕", category: "Models" },
  // Session
  { id: "__cat_session",   label: "Session",           description: "",                              icon: "", category: "Session", isHeader: true },
  { id: "clear",           label: "Clear History",     description: "Wipe conversation",             icon: "✕", category: "Session" },
  { id: "system-prompt",   label: "System Prompt",     description: "Update AI personality",         icon: "❯", category: "Session" },
  { id: "tokens",          label: "Token Usage",       description: "Show tokens used",              icon: "◷", category: "Session" },
  { id: "retry",           label: "Retry Last",        description: "Re-send your last message",     icon: "↺", category: "Session" },
  // Files
  { id: "__cat_files",     label: "Files",             description: "",                              icon: "", category: "Files",   isHeader: true },
  { id: "paste-image",     label: "Paste Image",       description: "Paste image from clipboard",    icon: "⎙", category: "Files" },
  { id: "upload-file",     label: "Upload File",       description: "Upload pdf/docx/xlsx/image...", icon: "↑", category: "Files" },
  // Output
  { id: "__cat_output",    label: "Output",            description: "",                              icon: "", category: "Output",  isHeader: true },
  { id: "save",            label: "Save Conversation", description: "Export chat to a text file",   icon: "⬇", category: "Output" },
  { id: "copy-last",       label: "Copy Last Reply",   description: "Copy AI reply to clipboard",    icon: "⎘", category: "Output" },
  // Settings
  { id: "__cat_settings",  label: "Settings",          description: "",                              icon: "", category: "Settings", isHeader: true },
  { id: "config",          label: "Configuration",     description: "View and change CLI settings",  icon: "⚙", category: "Settings" },
  { id: "switch-provider", label: "Switch Provider",   description: "Change between providers",      icon: "⇄", category: "Settings" },
  { id: "stream-toggle",   label: "Toggle Streaming",  description: "Turn streaming on or off",      icon: "≋", category: "Settings" },
  // Help
  { id: "__cat_help",      label: "Help",              description: "",                              icon: "", category: "Help",    isHeader: true },
  { id: "help",            label: "Help",              description: "Show all commands",             icon: "?", category: "Help" },
  { id: "exit",            label: "Exit",              description: "End session and close CLI",     icon: "✕", category: "Help" },
];

// ─── InteractiveMenu ──────────────────────────────────────────────────────────
export class InteractiveMenu {
  private selectedIndex = 0;
  private filterText = "";
  private filteredItems: MenuItem[] = [];
  private scrollOffset = 0;
  private readonly VISIBLE = 12;
  private lastRenderedLines = 0;
  private resolve!: (item: MenuItem | null) => void;
  private keyHandler!: (chunk: Buffer) => void;

  async show(): Promise<MenuItem | null> {
    this.filterText    = "";
    this.filteredItems = [...ALL_MENU_ITEMS];
    this.selectedIndex = this.firstSelectableIndex();
    this.scrollOffset  = 0;
    this.lastRenderedLines = 0;

    return new Promise<MenuItem | null>((res) => {
      this.resolve = res;
      process.stdout.write(CURSOR_HIDE);
      this.render();
      this.attachKeys();
    });
  }

  private applyFilter(): MenuItem[] {
    if (!this.filterText) return [...ALL_MENU_ITEMS];
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
    const w = BOX_W;
    const lines: string[] = [];

    const filterColored = this.filterText
      ? C.white(this.filterText)
      : C.gray("type to filter…");

    lines.push(
      "  " + C.dim("╭─ ") + C.violetBright("⌘ Menu ") + C.dim("─".repeat(w - 10)) + C.dim("╮")
    );
    lines.push(
      "  " + C.dim("│") +
      padRight("  " + C.dim("⌕  ") + filterColored, w) +
      C.dim("│")
    );
    lines.push(
      "  " + C.dim("├") + C.dim("─".repeat(w)) + C.dim("┤")
    );

    const visibleItems = this.filteredItems.slice(
      this.scrollOffset,
      this.scrollOffset + this.VISIBLE
    );

    if (visibleItems.length === 0) {
      lines.push(
        "  " + C.dim("│") +
        padRight(C.gray(`  No results for: "${this.filterText}"`), w) +
        C.dim("│")
      );
    } else {
      for (let i = 0; i < visibleItems.length; i++) {
        const item        = visibleItems[i];
        const actualIndex = i + this.scrollOffset;

        if (item.isHeader) {
          const headerLine = `  ▸ ${item.label}`;
          const dashes     = "·".repeat(Math.max(0, w - headerLine.length - 2));
          lines.push(
            "  " + C.dim("│") +
            padRight(C.violetBright(headerLine) + C.dim(dashes), w) +
            C.dim("│")
          );
        } else {
          const isSelected = actualIndex === this.selectedIndex;
          const icon       = item.icon || "·";
          const row        = `  ${icon} ${item.label.padEnd(20)} ${item.description}`;

          if (isSelected) {
            lines.push(
              "  " + C.dim("│") +
              C.selectedBg(padRight(row, w)) +
              C.dim("│")
            );
          } else {
            lines.push(
              "  " + C.dim("│") +
              padRight(
                C.violetDim(`  ${icon} `) +
                C.white(item.label.padEnd(20)) +
                C.gray(item.description),
                w
              ) +
              C.dim("│")
            );
          }
        }
      }
    }

    const total = this.filteredItems.filter((x) => !x.isHeader).length;
    if (total > this.VISIBLE) {
      lines.push(
        "  " + C.dim("│") +
        padRight(C.gray(`  ${Math.min(this.VISIBLE, visibleItems.length)}/${total}  ↑↓ scroll`), w) +
        C.dim("│")
      );
    }

    lines.push("  " + C.dim("├") + C.dim("─".repeat(w)) + C.dim("┤"));
    lines.push(
      "  " + C.dim("│") +
      padRight(C.gray("  ↑↓ navigate  ↵ select  Esc cancel  A-Z filter"), w) +
      C.dim("│")
    );
    lines.push("  " + C.dim("╰") + C.dim("─".repeat(w)) + C.dim("╯"));

    if (this.lastRenderedLines > 0) clearLines(this.lastRenderedLines);
    for (const line of lines) process.stdout.write(line + "\n");
    this.lastRenderedLines = lines.length;
  }

  private attachKeys(): void {
    const stdin = process.stdin;
    if (!stdin.isTTY) { this.cleanup(); this.resolve(null); return; }
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    this.keyHandler = (chunk: Buffer) => { this.handleKey(chunk.toString()); };
    (stdin as NodeJS.ReadStream).on("data", this.keyHandler);
  }

  private handleKey(key: string): void {
    if (key === "\x03") { this.cleanup(); process.exit(0); }
    if (key === "\x1B") { this.cleanup(); this.resolve(null); return; }
    if (key === "\r" || key === "\n") {
      const selected = this.filteredItems[this.selectedIndex];
      if (selected && !selected.isHeader) { this.cleanup(); this.resolve(selected); }
      return;
    }
    if (key === "\x1B[A") { this.moveSelection(-1); this.render(); return; }
    if (key === "\x1B[B") { this.moveSelection(1);  this.render(); return; }
    if (key === "\x1B[5~") { this.moveSelection(-this.VISIBLE); this.render(); return; }
    if (key === "\x1B[6~") { this.moveSelection(this.VISIBLE);  this.render(); return; }
    if (key === "\x7F" || key === "\b") {
      this.filterText    = this.filterText.slice(0, -1);
      this.filteredItems = this.applyFilter();
      this.selectedIndex = this.firstSelectableIndex();
      this.scrollOffset  = 0;
      this.render();
      return;
    }
    if (key === "\x15") {
      this.filterText    = "";
      this.filteredItems = this.applyFilter();
      this.selectedIndex = this.firstSelectableIndex();
      this.scrollOffset  = 0;
      this.render();
      return;
    }
    if (key.length === 1 && key >= " ") {
      this.filterText   += key;
      this.filteredItems = this.applyFilter();
      this.selectedIndex = this.firstSelectableIndex();
      this.scrollOffset  = 0;
      this.render();
    }
  }

  private moveSelection(delta: number): void {
    const selectables = this.filteredItems
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => !item.isHeader);
    if (selectables.length === 0) return;
    const cur  = selectables.findIndex(({ i }) => i === this.selectedIndex);
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
        (process.stdin as NodeJS.ReadStream).removeListener("data", this.keyHandler);
        process.stdin.setRawMode(false);
        process.stdin.pause();
      } catch (_) {}
    }
    process.stdout.write(CURSOR_SHOW);
    if (this.lastRenderedLines > 0) clearLines(this.lastRenderedLines);
  }
}

// ─── ModelPickerMenu ──────────────────────────────────────────────────────────
export interface ModelChoice {
  provider: Provider;
  model: string;
  description?: string;
}

export class ModelPickerMenu {
  private selectedIndex  = 0;
  private scrollOffset   = 0;
  private readonly VISIBLE = 14;
  private lastRenderedLines = 0;
  private items: Array<
    | { isHeader: true; label: string }
    | { isHeader: false; provider: Provider; model: string; description: string }
  > = [];
  private resolve!: (choice: ModelChoice | null) => void;
  private keyHandler!: (chunk: Buffer) => void;

  async show(): Promise<ModelChoice | null> {
    this.items             = await this.buildItems();
    this.selectedIndex     = this.firstSelectable();
    this.scrollOffset      = 0;
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

    result.push({ isHeader: true, label: "OLLAMA (local)" });
    try {
      const ollamaModels = await getOllamaModels();
      if (ollamaModels.length === 0) {
        result.push({ isHeader: false, provider: "ollama", model: "llama3.2", description: "default (not installed)" });
      } else {
        for (const m of ollamaModels) {
          result.push({ isHeader: false, provider: "ollama", model: m.name, description: m.size || "local" });
        }
      }
    } catch {
      result.push({ isHeader: false, provider: "ollama", model: "llama3.2", description: "Ollama not running" });
    }

    result.push({ isHeader: true, label: "GROQ (free cloud)" });
    for (const m of GROQ_MODELS) {
      result.push({ isHeader: false, provider: "groq", model: m.id, description: m.description });
    }

    result.push({ isHeader: true, label: "OPENROUTER (free models)" });
    for (const m of OPENROUTER_MODELS) {
      result.push({ isHeader: false, provider: "openrouter", model: m.id, description: m.description });
    }

    result.push({ isHeader: true, label: "GOOGLE GEMINI (free tier)" });
    for (const m of GOOGLE_MODELS) {
      result.push({ isHeader: false, provider: "google", model: m.id, description: m.description });
    }

    result.push({ isHeader: true, label: "KIMI (Moonshot AI)" });
    for (const m of KIMI_MODELS) {
      result.push({ isHeader: false, provider: "kimi", model: m.id, description: m.description });
    }

    result.push({ isHeader: true, label: "MINIMAX" });
    for (const m of MINIMAX_MODELS) {
      result.push({ isHeader: false, provider: "minimax", model: m.id, description: m.description });
    }

    result.push({ isHeader: true, label: "DEEPSEEK" });
    for (const m of DEEPSEEK_MODELS) {
      result.push({ isHeader: false, provider: "deepseek", model: m.id, description: m.description });
    }

    return result;
  }

  private firstSelectable(): number {
    for (let i = 0; i < this.items.length; i++) {
      if (!this.items[i].isHeader) return i;
    }
    return 0;
  }

  private render(): void {
    const w = BOX_W;
    const lines: string[] = [];

    lines.push(
      "  " + C.dim("╭─ ") + C.violetBright("◈ Select Model ") + C.dim("─".repeat(w - 18)) + C.dim("╮")
    );
    lines.push(
      "  " + C.dim("│") +
      padRight(C.gray("  ↑↓ navigate  ↵ select  Esc cancel"), w) +
      C.dim("│")
    );
    lines.push("  " + C.dim("├") + C.dim("─".repeat(w)) + C.dim("┤"));

    const visible = this.items.slice(this.scrollOffset, this.scrollOffset + this.VISIBLE);

    for (let i = 0; i < visible.length; i++) {
      const item        = visible[i];
      const actualIndex = i + this.scrollOffset;

      if (item.isHeader) {
        lines.push(
          "  " + C.dim("│") +
          padRight(C.violetBright(`  ▸ ${item.label}`), w) +
          C.dim("│")
        );
      } else {
        const isSelected = actualIndex === this.selectedIndex;
        const desc       = item.description || "";
        const row        = `  ❯ ${item.model.padEnd(32)} ${desc}`;

        if (isSelected) {
          lines.push(
            "  " + C.dim("│") + C.selectedBg(padRight(row, w)) + C.dim("│")
          );
        } else {
          lines.push(
            "  " + C.dim("│") +
            padRight(
              C.violetDim("  · ") + C.white(item.model.padEnd(32)) + C.gray(desc),
              w
            ) +
            C.dim("│")
          );
        }
      }
    }

    lines.push("  " + C.dim("╰") + C.dim("─".repeat(w)) + C.dim("╯"));

    if (this.lastRenderedLines > 0) clearLines(this.lastRenderedLines);
    for (const line of lines) process.stdout.write(line + "\n");
    this.lastRenderedLines = lines.length;
  }

  private attachKeys(): void {
    const stdin = process.stdin;
    if (!stdin.isTTY) { this.cleanup(); this.resolve(null); return; }
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    this.keyHandler = (chunk: Buffer) => {
      const key = chunk.toString();
      if (key === "\x03") { this.cleanup(); process.exit(0); }
      if (key === "\x1B") { this.cleanup(); this.resolve(null); return; }
      if (key === "\r" || key === "\n") {
        const item = this.items[this.selectedIndex];
        if (item && !item.isHeader) {
          this.cleanup();
          this.resolve({ provider: item.provider, model: item.model, description: item.description });
        }
        return;
      }
      if (key === "\x1B[A") { this.moveSelection(-1); this.render(); return; }
      if (key === "\x1B[B") { this.moveSelection(1);  this.render(); return; }
    };
    (stdin as NodeJS.ReadStream).on("data", this.keyHandler);
  }

  private moveSelection(delta: number): void {
    const selectables = this.items.map((item, i) => ({ item, i })).filter(({ item }) => !item.isHeader);
    if (selectables.length === 0) return;
    const cur  = selectables.findIndex(({ i }) => i === this.selectedIndex);
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
        (process.stdin as NodeJS.ReadStream).removeListener("data", this.keyHandler);
        process.stdin.setRawMode(false);
        process.stdin.pause();
      } catch (_) {}
    }
    process.stdout.write(CURSOR_SHOW);
    if (this.lastRenderedLines > 0) clearLines(this.lastRenderedLines);
  }
}

// ─── ProviderPickerMenu ───────────────────────────────────────────────────────
const PROVIDERS: Array<{ id: Provider; name: string; description: string; icon: string }> = [
  { id: "ollama",      name: "Ollama",          description: "Local models, always free",    icon: "◉" },
  { id: "groq",        name: "Groq",            description: "Fastest free cloud inference", icon: "⚡" },
  { id: "openrouter",  name: "OpenRouter",      description: "Most free models available",   icon: "◈" },
  { id: "google",      name: "Google Gemini",   description: "Google free tier",             icon: "✦" },
  { id: "kimi",        name: "Kimi (Moonshot)", description: "Kimi K2 and more",             icon: "◎" },
  { id: "minimax",     name: "MiniMax",         description: "MiniMax 2.5 and more",         icon: "◇" },
  { id: "deepseek",    name: "DeepSeek",        description: "DeepSeek V3/R1 and more",      icon: "◆" },
];

export class ProviderPickerMenu {
  private selectedIndex    = 0;
  private lastRenderedLines = 0;
  private resolve!: (provider: Provider | null) => void;
  private keyHandler!: (chunk: Buffer) => void;

  async show(): Promise<Provider | null> {
    this.selectedIndex     = 0;
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

    lines.push(
      "  " + C.dim("╭─ ") + C.violetBright("⇄ Select Provider ") + C.dim("─".repeat(w - 21)) + C.dim("╮")
    );
    lines.push(
      "  " + C.dim("│") +
      padRight(C.gray("  ↑↓ navigate  ↵ select  Esc cancel"), w) +
      C.dim("│")
    );
    lines.push("  " + C.dim("├") + C.dim("─".repeat(w)) + C.dim("┤"));

    for (let i = 0; i < PROVIDERS.length; i++) {
      const p          = PROVIDERS[i];
      const isSelected = i === this.selectedIndex;
      const row        = `  ${p.icon} ${p.name.padEnd(18)} ${p.description}`;

      if (isSelected) {
        lines.push(
          "  " + C.dim("│") + C.selectedBg(padRight(row, w)) + C.dim("│")
        );
      } else {
        lines.push(
          "  " + C.dim("│") +
          padRight(
            C.violetDim(`  ${p.icon} `) +
            C.white(p.name.padEnd(18)) +
            C.gray(p.description),
            w
          ) +
          C.dim("│")
        );
      }
    }

    lines.push("  " + C.dim("╰") + C.dim("─".repeat(w)) + C.dim("╯"));

    if (this.lastRenderedLines > 0) clearLines(this.lastRenderedLines);
    for (const line of lines) process.stdout.write(line + "\n");
    this.lastRenderedLines = lines.length;
  }

  private attachKeys(): void {
    const stdin = process.stdin;
    if (!stdin.isTTY) { this.cleanup(); this.resolve(null); return; }
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    this.keyHandler = (chunk: Buffer) => {
      const key = chunk.toString();
      if (key === "\x03") { this.cleanup(); process.exit(0); }
      if (key === "\x1B") { this.cleanup(); this.resolve(null); return; }
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
        this.selectedIndex = Math.min(PROVIDERS.length - 1, this.selectedIndex + 1);
        this.render();
        return;
      }
    };
    (stdin as NodeJS.ReadStream).on("data", this.keyHandler);
  }

  private cleanup(): void {
    if (process.stdin.isTTY) {
      try {
        (process.stdin as NodeJS.ReadStream).removeListener("data", this.keyHandler);
        process.stdin.setRawMode(false);
        process.stdin.pause();
      } catch (_) {}
    }
    process.stdout.write(CURSOR_SHOW);
    if (this.lastRenderedLines > 0) clearLines(this.lastRenderedLines);
  }
}