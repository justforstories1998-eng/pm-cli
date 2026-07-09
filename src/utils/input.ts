import readline from "readline";
import { renderInputBox } from "./display";

const CURSOR_UP = "\x1B[1A";
const CLEAR_LINE = "\x1B[2K";
const CURSOR_COL0 = "\x1B[G";
const CURSOR_SHOW = "\x1B[?25h";

function clearLines(n: number): void {
  for (let i = 0; i < n; i++) {
    process.stdout.write(CURSOR_UP + CLEAR_LINE);
  }
  process.stdout.write(CURSOR_COL0);
}

type Mode = "input" | "menu" | "submit";


export class SmartInput {
  private buffer = "";
  private lastRenderedLines = 0;

  private mode: Mode = "input";
  private paused = false;

  private readonly rl: readline.Interface;
  private readonly onSubmit: (input: string) => Promise<void>;
  private readonly onMenu: () => Promise<void>;

  private keyHandler!: (chunk: Buffer) => void;
  private attached = false;

  constructor(
    rl: readline.Interface,
    onSubmit: (input: string) => Promise<void>,
    onMenu: () => Promise<void>
  ) {
    this.rl = rl;
    this.onSubmit = onSubmit;
    this.onMenu = onMenu;
  }

  start(): void {
    // For the interactive mode we only support TTY.
    // If not a TTY, fall back to readline "line" event (no raw mode / key-by-key UI).
    if (!process.stdin.isTTY) {
      this.rl.on("line", async (line) => {
        if (this.mode !== "input") return;
        const text = line.trim();
        if (text) await this.onSubmit(text);
      });
      return;
    }

    if (this.attached) return;

    this.renderPrompt();

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    this.keyHandler = async (chunk: Buffer) => {
      await this.handleKey(chunk.toString());
    };

    // Ensure we never attach multiple listeners (per session)
    try {
      (process.stdin as NodeJS.ReadStream).removeListener(
        "data",
        this.keyHandler
      );
    } catch (_) {}
    (process.stdin as NodeJS.ReadStream).on("data", this.keyHandler);

    this.attached = true;
  }

  stop(): void {
    this.mode = "input";
    if (!process.stdin.isTTY) return;

    try {
      if (this.attached) {
        (process.stdin as NodeJS.ReadStream).removeListener(
          "data",
          this.keyHandler
        );
        process.stdin.setRawMode(false);
        process.stdin.pause();
      }
    } catch (_) {}

    this.attached = false;
  }

  private renderPrompt(): void {
    const lines = renderInputBox(this.buffer);
    if (this.lastRenderedLines > 0) clearLines(this.lastRenderedLines);
    for (const line of lines) process.stdout.write(line + "\n");
    this.lastRenderedLines = lines.length;

    // Cursor positioning: move back up to the input row.
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

  private async handleKey(key: string): Promise<void> {
    if (this.paused) return;

    // Never process keys while in menu/submit.
    if (this.mode !== "input") return;

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
      const text = this.buffer.trim();
      // Always reset input buffer immediately to avoid re-submits from stacked UI events.
      this.buffer = "";

      // Re-render once empty (so UI doesn't stack while submit is running)
      this.renderPrompt();

      this.mode = "submit";
      this.paused = true; // stop SmartInput while streaming/submit runs
      try {
        if (text) await this.onSubmit(text);
      } finally {
        this.paused = false;
        this.mode = "input";
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

    // Arrow keys — ignore (menus handle arrow keys internally)
    if (key.startsWith("\x1B[")) return;

    // Printable characters
    if (key.length >= 1 && key >= " ") {
      // UX: typing "/" as the first character opens the menu immediately.
      if (key === "/" && this.buffer === "") {
        this.clearPrompt();
        this.mode = "menu";
        this.paused = true; // stop SmartInput from listening while menu owns stdin
        try {
          await this.onMenu();
        } finally {
          this.paused = false;
          this.mode = "input";
          this.buffer = "";
          this.renderPrompt();
        }
        return;
      }

      this.buffer += key;
      this.renderPrompt();
    }
  }
}
