import readline from "readline";
import chalk from "chalk";
import { InteractiveMenu, MenuItem } from "./menu";

const C = {
  red: chalk.hex("#FF2222"),
  redDim: chalk.hex("#991111"),
  white: chalk.hex("#FFFFFF"),
  whiteDim: chalk.hex("#CCCCCC"),
  gray: chalk.hex("#666666"),
};

const ESC = "\x1B";
const CLEAR_LINE = `${ESC}[2K`;
const CURSOR_UP = `${ESC}[1A`;
const CURSOR_COL0 = `${ESC}[G`;

function clearLines(n: number): void {
  for (let i = 0; i < n; i++) {
    process.stdout.write(CURSOR_UP + CLEAR_LINE);
  }
  process.stdout.write(CURSOR_COL0);
}

export class SmartInput {
  private buffer = "";
  private lastRenderedLines = 0;
  private active = false;
  private keyHandler!: (chunk: Buffer) => void;

  constructor(
    private readonly rl: readline.Interface,
    private readonly onSubmit: (input: string) => Promise<void>,
    private readonly onMenu: () => Promise<void>
  ) {}

  start(): void {
    this.active = true;
    this.buffer = "";
    this.lastRenderedLines = 0;
    this.renderPrompt();
    this.attachRawMode();
  }

  stop(): void {
    this.active = false;
    this.detachRawMode();
  }

  private renderPrompt(): void {
    const lines: string[] = [];
    lines.push(C.red("╔═ YOU ═╗"));
    lines.push(C.red("╚═══════╝"));

    let inputLine: string;
    if (this.buffer === "/") {
      inputLine =
        C.white("/") + C.gray(" ↵ Enter to open menu · or keep typing");
    } else if (this.buffer.length > 0) {
      inputLine = C.white(this.buffer) + C.gray("█");
    } else {
      inputLine = C.gray("Message… (/ for menu, Ctrl+C to exit)");
    }
    lines.push(inputLine);

    if (this.lastRenderedLines > 0) {
      clearLines(this.lastRenderedLines);
    }

    for (const line of lines) {
      process.stdout.write(line + "\n");
    }
    this.lastRenderedLines = lines.length;
  }

  private clearPrompt(): void {
    if (this.lastRenderedLines > 0) {
      clearLines(this.lastRenderedLines);
      this.lastRenderedLines = 0;
    }
  }

  private attachRawMode(): void {
    if (!process.stdin.isTTY) {
      // Fallback: use readline
      this.rl.on("line", async (line) => {
        if (!this.active) return;
        await this.handleSubmit(line.trim());
      });
      return;
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    this.keyHandler = async (chunk: Buffer) => {
      if (!this.active) return;
      const key = chunk.toString();
      await this.handleKey(key);
    };

    (process.stdin as NodeJS.ReadStream).on("data", this.keyHandler);
  }

  private detachRawMode(): void {
    if (!process.stdin.isTTY) return;
    try {
      (process.stdin as NodeJS.ReadStream).removeListener(
        "data",
        this.keyHandler
      );
      process.stdin.setRawMode(false);
      process.stdin.pause();
    } catch (_) {}
  }

  private async handleKey(key: string): Promise<void> {
    // Ctrl+C
    if (key === "\x03") {
      process.exit(0);
    }

    // Escape → clear buffer
    if (key === "\x1B") {
      this.buffer = "";
      this.renderPrompt();
      return;
    }

    // Enter
    if (key === "\r" || key === "\n") {
      if (this.buffer === "/") {
        this.clearPrompt();
        await this.openMenu();
        return;
      }
      const text = this.buffer.trim();
      this.buffer = "";
      if (text) {
        this.clearPrompt();
        await this.handleSubmit(text);
      } else {
        this.renderPrompt();
      }
      return;
    }

    // Backspace
    if (key === "\x7F" || key === "\b") {
      this.buffer = this.buffer.slice(0, -1);
      this.renderPrompt();
      return;
    }

    // Arrow keys → ignore
    if (key.startsWith("\x1B[")) {
      return;
    }

    // Ctrl+U → clear line
    if (key === "\x15") {
      this.buffer = "";
      this.renderPrompt();
      return;
    }

    // Printable character
    if (key.length >= 1 && key >= " ") {
      this.buffer += key;
      this.renderPrompt();
      return;
    }
  }

  private async handleSubmit(text: string): Promise<void> {
    this.detachRawMode();
    try {
      await this.onSubmit(text);
    } finally {
      if (this.active) {
        this.buffer = "";
        this.lastRenderedLines = 0;
        this.renderPrompt();
        this.attachRawMode();
      }
    }
  }

  private async openMenu(): Promise<void> {
    this.detachRawMode();
    try {
      await this.onMenu();
    } finally {
      if (this.active) {
        this.buffer = "";
        this.lastRenderedLines = 0;
        this.renderPrompt();
        this.attachRawMode();
      }
    }
  }
}