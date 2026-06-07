import chalk from "chalk";
import { setLastOpenRouterModel } from "../config";

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

const C = {
  violet:       chalk.hex("#8B5CF6"),
  violetBright: chalk.hex("#A78BFA"),
  violetDim:    chalk.hex("#4C1D95"),
  white:        chalk.hex("#F0F0F0"),
  white90:      chalk.hex("#E6E6E6"),
  white40:      chalk.hex("#666666"),
  dim:          chalk.hex("#444449"),
  gray:         chalk.hex("#555560"),
  selectedBg:   chalk.bgHex("#2D1B69").hex("#E0D7FF"),
};

const BOX_W = 64;

export interface OpenRouterModelEntry {
  id: string;
  description: string;
  category: string;
  isHeader?: boolean;
}

export const ALL_OPENROUTER_MODELS: OpenRouterModelEntry[] = [
  // DeepSeek
  { id: "__cat", category: "DeepSeek",       description: "", isHeader: true },
  { id: "deepseek/deepseek-r1:free",                    description: "Best reasoning · free",        category: "DeepSeek" },
  { id: "deepseek/deepseek-chat-v3-0324:free",          description: "DeepSeek V3 · free",           category: "DeepSeek" },
  { id: "deepseek/deepseek-r1-distill-llama-70b:free",  description: "R1 distilled 70B · free",      category: "DeepSeek" },
  { id: "deepseek/deepseek-r1-distill-qwen-32b:free",   description: "R1 distilled 32B · free",      category: "DeepSeek" },
  // Kimi
  { id: "__cat", category: "Kimi (Moonshot)", description: "", isHeader: true },
  { id: "moonshotai/kimi-k2.6:free",                      description: "Kimi K2.6 · free",               category: "Kimi (Moonshot)" },
  { id: "moonshotai/kimi-vl-a3b-thinking:free",         description: "Kimi Vision thinking · free",  category: "Kimi (Moonshot)" },
  // Meta Llama
  { id: "__cat", category: "Meta Llama",     description: "", isHeader: true },
  { id: "meta-llama/llama-3.3-70b-instruct:free",       description: "Llama 3.3 70B · free",         category: "Meta Llama" },
  { id: "meta-llama/llama-3.2-3b-instruct:free",        description: "Fast · free",                  category: "Meta Llama" },
  { id: "meta-llama/llama-3.1-8b-instruct:free",        description: "Balanced · free",              category: "Meta Llama" },
  { id: "meta-llama/llama-3.2-1b-instruct:free",        description: "Tiny · free",                  category: "Meta Llama" },
  // Google Gemma
  { id: "__cat", category: "Google Gemma",   description: "", isHeader: true },
  { id: "google/gemma-3-27b-it:free",                   description: "Gemma 3 large · free",         category: "Google Gemma" },
  { id: "google/gemma-3-12b-it:free",                   description: "Gemma 3 medium · free",        category: "Google Gemma" },
  { id: "google/gemma-3-4b-it:free",                    description: "Gemma 3 small · free",         category: "Google Gemma" },
  { id: "google/gemma-2-9b-it:free",                    description: "Gemma 2 · free",               category: "Google Gemma" },
  // Qwen
  { id: "__cat", category: "Qwen",           description: "", isHeader: true },
  { id: "qwen/qwen3-32b:free",                          description: "Qwen3 32B · free",             category: "Qwen" },
  { id: "qwen/qwen3-14b:free",                          description: "Qwen3 14B · free",             category: "Qwen" },
  { id: "qwen/qwen3-8b:free",                           description: "Qwen3 8B · free",              category: "Qwen" },
  { id: "qwen/qwen-2.5-72b-instruct:free",              description: "72B strong · free",            category: "Qwen" },
  { id: "qwen/qwen2.5-vl-7b-instruct:free",             description: "Vision 7B · free",             category: "Qwen" },
  // Microsoft
  { id: "__cat", category: "Microsoft",      description: "", isHeader: true },
  { id: "microsoft/phi-3-mini-128k-instruct:free",      description: "128K context · free",          category: "Microsoft" },
  { id: "microsoft/phi-3-medium-128k-instruct:free",    description: "Phi3 medium · free",           category: "Microsoft" },
  // Mistral
  { id: "__cat", category: "Mistral",        description: "", isHeader: true },
  { id: "mistralai/mistral-7b-instruct:free",           description: "Efficient · free",             category: "Mistral" },
  { id: "mistralai/mistral-small-3.2-24b-instruct:free", description: "Mistral Small · free",        category: "Mistral" },
  // Others
  { id: "__cat", category: "Others",         description: "", isHeader: true },
  { id: "nousresearch/hermes-3-llama-3.1-8b:free",      description: "Hermes 3 · free",              category: "Others" },
  { id: "openchat/openchat-7b:free",                    description: "OpenChat · free",              category: "Others" },
  { id: "huggingfaceh4/zephyr-7b-beta:free",            description: "Zephyr 7B · free",             category: "Others" },
  { id: "gryphe/mythomax-l2-13b:free",                  description: "MythoMax 13B · free",          category: "Others" },
  //Poolside
  { id: "__cat", category: "Poolside",       description: "", isHeader: true },
  { id: "poolside/laguna-m.1:free",                  description: "Poolside: Laguna M.1 (free)",         category: "Poolside" },
];

export class OpenRouterModelSwitcher {
  private selectedIndex    = 0;
  private scrollOffset     = 0;
  private filterText       = "";
  private filteredItems: OpenRouterModelEntry[] = [];
  private readonly VISIBLE = 14;
  private lastRenderedLines = 0;
  private resolve!: (model: string | null) => void;
  private keyHandler!: (chunk: Buffer) => void;
  private currentModel: string;

  constructor(currentModel: string) {
    this.currentModel = currentModel;
  }

  async show(): Promise<string | null> {
    this.filterText       = "";
    this.filteredItems    = this.applyFilter();
    this.selectedIndex    = this.firstSelectableIndex();
    this.scrollOffset     = 0;
    this.lastRenderedLines = 0;

    return new Promise<string | null>((res) => {
      this.resolve = res;
      process.stdout.write(CURSOR_HIDE);
      this.render();
      this.attachKeys();
    });
  }

  private applyFilter(): OpenRouterModelEntry[] {
    if (!this.filterText) return [...ALL_OPENROUTER_MODELS];
    const q = this.filterText.toLowerCase();
    const result: OpenRouterModelEntry[] = [];
    for (const item of ALL_OPENROUTER_MODELS) {
      if (item.isHeader) continue;
      if (
        item.id.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
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

    const filterDisplay = this.filterText
      ? C.white(this.filterText)
      : C.gray("type to filter…");

    lines.push(
      "  " + C.dim("╭─ ") + C.violetBright("◈ OpenRouter Models ") + C.dim("─".repeat(w - 23)) + C.dim("╮")
    );
    lines.push(
      "  " + C.dim("│") +
      padRight(C.white40("  Current: ") + C.violetBright(this.currentModel), w) +
      C.dim("│")
    );
    lines.push(
      "  " + C.dim("│") +
      padRight(C.dim("  ⌕  ") + filterDisplay, w) +
      C.dim("│")
    );
    lines.push("  " + C.dim("├") + C.dim("─".repeat(w)) + C.dim("┤"));

    const visible = this.filteredItems.slice(this.scrollOffset, this.scrollOffset + this.VISIBLE);

    if (visible.length === 0) {
      lines.push(
        "  " + C.dim("│") +
        padRight(C.gray(`  No models match: "${this.filterText}"`), w) +
        C.dim("│")
      );
    } else {
      for (let i = 0; i < visible.length; i++) {
        const item       = visible[i];
        const aIdx       = i + this.scrollOffset;

        if (item.isHeader) {
          lines.push(
            "  " + C.dim("│") +
            padRight(
              C.violetBright(`  ▸ ${item.category} `) +
              C.dim("·".repeat(Math.max(0, w - item.category.length - 7))),
              w
            ) +
            C.dim("│")
          );
        } else {
          const isCurrent  = item.id === this.currentModel;
          const isSelected = aIdx === this.selectedIndex;
          const marker     = isCurrent ? "✦" : "·";
          const modelShort = item.id.length > 38 ? item.id.slice(0, 35) + "…" : item.id;
          const row        = `  ${marker} ${modelShort.padEnd(38)} ${item.description}`;

          if (isSelected) {
            lines.push(
              "  " + C.dim("│") + C.selectedBg(padRight(row, w)) + C.dim("│")
            );
          } else if (isCurrent) {
            lines.push(
              "  " + C.dim("│") +
              padRight(
                C.violetBright(`  ${marker} `) + C.white(modelShort.padEnd(38)) + C.gray(item.description),
                w
              ) +
              C.dim("│")
            );
          } else {
            lines.push(
              "  " + C.dim("│") +
              padRight(
                C.dim(`  ${marker} `) + C.white40(modelShort.padEnd(38)) + C.dim(item.description),
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
        padRight(C.gray(`  ${Math.min(this.VISIBLE, visible.filter(x => !x.isHeader).length)}/${total} models  ↑↓ scroll`), w) +
        C.dim("│")
      );
    }

    lines.push("  " + C.dim("├") + C.dim("─".repeat(w)) + C.dim("┤"));
    lines.push(
      "  " + C.dim("│") +
      padRight(C.gray("  ↑↓ navigate  ↵ select  Esc cancel  type to filter"), w) +
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
      const item = this.filteredItems[this.selectedIndex];
      if (item && !item.isHeader) {
        this.cleanup();
        this.resolve(item.id);
      }
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
      return;
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