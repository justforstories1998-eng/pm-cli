import readline from "readline";
import { renderInputBox, stripAnsi } from "./display";

const CURSOR_UP   = "\x1B[1A";
const CLEAR_LINE  = "\x1B[2K";
const CURSOR_COL0 = "\x1B[G";
const CURSOR_SHOW = "\x1B[?25h";

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
    const lines = renderInputBox(this.buffer);
    if (this.lastRenderedLines > 0) clearLines(this.lastRenderedLines);
    for (const line of lines) process.stdout.write(line + "\n");
    this.lastRenderedLines = lines.length;

    // Put the blinking cursor back on the actual input row (line index 1 in renderInputBox).
    // After writing, the terminal cursor is positioned on the line AFTER the last printed line,
    // so we move up (lines.length - 2) lines and reset column to 0.
    const moveUp = Math.max(0, lines.length - 2);
    if (moveUp > 0) process.stdout.write("\x1B[" + moveUp + "A");
    process.stdout.write("\x1B[G");
  }

  private clearPrompt(): void {
    if (this.lastRenderedLines > 0) {
      clearLines(this.lastRenderedLines);
      this.lastRenderedLines = 0;
    }
  }

  private attachRawMode(): void {
    if (!process.stdin.isTTY) {
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
      await this.handleKey(chunk.toString());
    };

    (process.stdin as NodeJS.ReadStream).on("data", this.keyHandler);
  }

  private detachRawMode(): void {
    if (!process.stdin.isTTY) return;
    try {
      (process.stdin as NodeJS.ReadStream).removeListener("data", this.keyHandler);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    } catch (_) {}
  }

  private async handleKey(key: string): Promise<void> {
    // Ctrl+C
    if (key === "\x03") {
      process.stdout.write(CURSOR_SHOW);
      process.exit(0);
    }

    // Escape — clear buffer
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

    // Ctrl+U — clear line
    if (key === "\x15") {
      this.buffer = "";
      this.renderPrompt();
      return;
    }

    // Arrow keys — ignore (reserved for menus)
    if (key.startsWith("\x1B[")) return;

    // Printable characters
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