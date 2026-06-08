import fs from "fs";
import path from "path";
import {
  readFile,
  writeFile,
  listDirectory,
  searchInFiles,
  buildFileContext,
} from "./fileworker";
import {
  printInfo,
  printSuccess,
  printError,
  printWarning,
  C,
  stripAnsi,
} from "./display";
import chalk from "chalk";

export interface AgentAction {
  type:
    | "read_file"
    | "write_file"
    | "list_dir"
    | "search"
    | "done"
    | "error";
  path?: string;
  content?: string;
  query?: string;
  message?: string;
}

export interface FileContext {
  path: string;
  content: string;
  lines: number;
}

export interface AgentPlan {
  filesToRead: string[];
  filesToEdit: string[];
  filesToCreate: string[];
  reasoning: string;
  confidence: number;
}

export interface ProgressState {
  current: number;
  total: number;
  label: string;
  phase:
    | "scanning"
    | "reading"
    | "analyzing"
    | "planning"
    | "writing"
    | "done";
}

// ─── Terminal width helper ────────────────────────────────────────────────────
export function getWidth(): number {
  return Math.max(50, Math.min(100, (process.stdout.columns || 80) - 2));
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
export class AgentProgressBar {
  private current = 0;
  private total = 100;
  private label = "";
  private phase: ProgressState["phase"] = "scanning";
  private spinnerFrame = 0;
  private spinnerFrames = [
    "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏",
  ];
  private interval: NodeJS.Timeout | null = null;
  private startTime = Date.now();
  private lastLineCount = 0;

  private phaseColors: Record<ProgressState["phase"], string> = {
    scanning: "#F59E0B",
    reading: "#F87171",
    analyzing: "#FB923C",
    planning: "#FBBF24",
    writing: "#DC2626",
    done: "#10B981",
  };

  private phaseIcons: Record<ProgressState["phase"], string> = {
    scanning: "◈",
    reading: "⎙",
    analyzing: "✦",
    planning: "◉",
    writing: "✎",
    done: "✓",
  };

  start(
    total: number,
    label: string,
    phase: ProgressState["phase"] = "scanning"
  ): void {
    this.current = 0;
    this.total = Math.max(1, total);
    this.label = label;
    this.phase = phase;
    this.startTime = Date.now();
    this.lastLineCount = 0;
    this.render();
    this.interval = setInterval(() => {
      this.spinnerFrame =
        (this.spinnerFrame + 1) % this.spinnerFrames.length;
      this.render();
    }, 80);
  }

  update(
    current: number,
    label?: string,
    phase?: ProgressState["phase"]
  ): void {
    this.current = current;
    if (label) this.label = label;
    if (phase) this.phase = phase;
    this.render();
  }

  increment(label?: string): void {
    this.update(this.current + 1, label);
  }

  finish(label = "Complete"): void {
    this.current = this.total;
    this.phase = "done";
    this.label = label;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.render();
    setTimeout(() => {
      if (this.lastLineCount > 0) {
        process.stdout.write(`\x1B[${this.lastLineCount}A\x1B[0J`);
        this.lastLineCount = 0;
      }
    }, 600);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.lastLineCount > 0) {
      process.stdout.write(`\x1B[${this.lastLineCount}A\x1B[0J`);
      this.lastLineCount = 0;
    }
  }

  private render(): void {
    const w = getWidth();
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const pct =
      this.total > 0
        ? Math.min(100, Math.round((this.current / this.total) * 100))
        : 0;
    const color = this.phaseColors[this.phase];
    const icon = this.phaseIcons[this.phase];
    const spinner =
      this.phase === "done"
        ? "✓"
        : this.spinnerFrames[this.spinnerFrame];

    const barWidth = Math.max(20, w - 30);
    const filled = Math.round((pct / 100) * barWidth);
    const empty = barWidth - filled;

    const filledBar = chalk.hex(color)("█".repeat(Math.max(0, filled)));
    const emptyBar = chalk.hex("#333338")("░".repeat(Math.max(0, empty)));

    const etaMs =
      this.current > 0 && this.current < this.total
        ? ((Date.now() - this.startTime) / this.current) *
          (this.total - this.current)
        : 0;
    const eta = etaMs > 0 ? ` ETA ${(etaMs / 1000).toFixed(0)}s` : "";

    const lines: string[] = [
      "",
      `  ${chalk.hex(color)(spinner)} ${chalk.hex(color)(icon)} ${chalk.hex(
        color
      )(this.phase.toUpperCase())} ${chalk.hex("#666670")(
        `[${this.current}/${this.total}]`
      )} ${chalk.hex("#444449")(`${elapsed}s${eta}`)}`,
      `  ${filledBar}${emptyBar} ${chalk.hex(color)(`${pct}%`)}`,
      `  ${chalk.hex("#B3B3B3")(this.label.slice(0, w - 4))}`,
      "",
    ];

    if (this.lastLineCount > 0) {
      process.stdout.write(`\x1B[${this.lastLineCount}A\x1B[0J`);
    }

    process.stdout.write(lines.join("\n"));
    this.lastLineCount = lines.length;
  }
}

// ─── Thinking Display ─────────────────────────────────────────────────────────
export class ThinkingDisplay {
  private thoughts: string[] = [];
  private frame = 0;
  private frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private interval: NodeJS.Timeout | null = null;
  private lastLineCount = 0;
  private startTime = Date.now();
  private running = false;

  start(): void {
    if (this.running) return;
    this.running = true;
    this.thoughts = [];
    this.startTime = Date.now();
    this.lastLineCount = 0;
    this.render();
    this.interval = setInterval(() => {
      this.frame = (this.frame + 1) % this.frames.length;
      this.render();
    }, 100);
  }

  addThought(thought: string): void {
    if (!this.running) return;
    this.thoughts.push(thought);
    if (this.thoughts.length > 5) this.thoughts.shift();
    this.render();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.lastLineCount > 0) {
      process.stdout.write(`\x1B[${this.lastLineCount}A\x1B[0J`);
      this.lastLineCount = 0;
    }
  }

  private render(): void {
    if (!this.running) return;
    const w = getWidth();
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const spinner = this.frames[this.frame];
    const innerW = w - 6;

    const lines: string[] = [""];
    lines.push(
      `  ${chalk.hex("#7F1D1D")("╭─")} ${chalk.hex("#F87171")(spinner)} ` +
        `${chalk.hex("#F59E0B")("THINKING")} ${chalk.hex(
          "#666670"
        )(`${elapsed}s`)} ` +
        `${chalk.hex("#7F1D1D")(
          "─".repeat(Math.max(0, innerW - 16))
        )}${chalk.hex("#7F1D1D")("╮")}`
    );

    const displayThoughts =
      this.thoughts.length === 0 ? ["Processing…"] : this.thoughts;

    for (const thought of displayThoughts) {
      const truncated = thought.slice(0, innerW);
      const padded = truncated.padEnd(innerW);
      lines.push(
        `  ${chalk.hex("#7F1D1D")("│")} ${chalk.hex("#B3B3B3")(
          padded
        )} ${chalk.hex("#7F1D1D")("│")}`
      );
    }

    lines.push(
      `  ${chalk.hex("#7F1D1D")("╰")}${chalk.hex("#7F1D1D")(
        "─".repeat(innerW + 2)
      )}${chalk.hex("#7F1D1D")("╯")}`
    );
    lines.push("");

    if (this.lastLineCount > 0) {
      process.stdout.write(`\x1B[${this.lastLineCount}A\x1B[0J`);
    }

    process.stdout.write(lines.join("\n"));
    this.lastLineCount = lines.length;
  }
}

// ─── Agent Status Display ─────────────────────────────────────────────────────
export class AgentStatusDisplay {
  private steps: Array<{
    icon: string;
    label: string;
    status: "pending" | "active" | "done" | "error";
    detail?: string;
  }> = [];
  private lastLineCount = 0;
  private frame = 0;
  private frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  start(): void {
    this.steps = [];
    this.lastLineCount = 0;
    this.running = true;
    this.interval = setInterval(() => {
      this.frame = (this.frame + 1) % this.frames.length;
      this.render();
    }, 100);
  }

  stop(): void {
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.lastLineCount > 0) {
      process.stdout.write(`\x1B[${this.lastLineCount}A\x1B[0J`);
      this.lastLineCount = 0;
    }
    this.steps = [];
  }

  addStep(icon: string, label: string): number {
    this.steps.push({ icon, label, status: "pending" });
    this.render();
    return this.steps.length - 1;
  }

  setActive(idx: number, detail?: string): void {
    if (this.steps[idx]) {
      this.steps[idx].status = "active";
      if (detail !== undefined) this.steps[idx].detail = detail;
      this.render();
    }
  }

  setDone(idx: number, detail?: string): void {
    if (this.steps[idx]) {
      this.steps[idx].status = "done";
      if (detail !== undefined) this.steps[idx].detail = detail;
      this.render();
    }
  }

  setError(idx: number, detail?: string): void {
    if (this.steps[idx]) {
      this.steps[idx].status = "error";
      if (detail !== undefined) this.steps[idx].detail = detail;
      this.render();
    }
  }

  private render(): void {
    if (!this.running) return;
    const lines: string[] = [""];

    for (const step of this.steps) {
      let statusIcon: string;
      let color: string;

      switch (step.status) {
        case "active":
          statusIcon = this.frames[this.frame];
          color = "#F59E0B";
          break;
        case "done":
          statusIcon = "✓";
          color = "#10B981";
          break;
        case "error":
          statusIcon = "✕";
          color = "#EF4444";
          break;
        default:
          statusIcon = "·";
          color = "#444449";
      }

      const detail = step.detail
        ? chalk.hex("#666670")(` — ${step.detail.slice(0, 40)}`)
        : "";
      lines.push(
        `  ${chalk.hex(color)(statusIcon)} ${chalk.hex(color)(
          step.icon
        )} ${chalk.hex(
          step.status === "pending" ? "#444449" : "#E6E6E6"
        )(step.label)}${detail}`
      );
    }

    lines.push("");

    if (this.lastLineCount > 0) {
      process.stdout.write(`\x1B[${this.lastLineCount}A\x1B[0J`);
    }

    process.stdout.write(lines.join("\n"));
    this.lastLineCount = lines.length;
  }
}

// ─── Detect if message needs file operations ──────────────────────────────────
export function needsFileAccess(message: string): boolean {
  const triggers = [
    "fix", "repair", "correct", "debug", "solve", "resolve",
    "edit", "update", "change", "modify", "refactor", "improve",
    "rewrite", "add", "remove", "delete", "rename",
    "read", "show", "display", "open", "look at", "check",
    "review", "analyze", "analyse", "explain", "understand",
    "design", "style", "layout", "theme", "color", "colour",
    "project", "codebase", "all files", "everything",
    "directory", "folder", "file",
    ".ts", ".js", ".py", ".json", ".md", ".txt", ".css", ".html",
    "function", "class", "component", "module", "import",
    "error", "bug", "issue", "problem", "warning",
    "performance", "optimize", "optimise", "clean", "format",
    "lint", "test", "build", "deploy", "create", "make",
    "generate", "enhance", "upgrade", "migrate",
  ];
  const lower = message.toLowerCase();
  return triggers.some((t) => lower.includes(t));
}

// ─── Extract file references from message ────────────────────────────────────
export function extractFileRefs(message: string): string[] {
  const refs: string[] = [];
  const pathRegex = /(?:^|\s)((?:[\w\-./\\]+\/)*[\w\-]+\.\w+)/g;
  let match;
  while ((match = pathRegex.exec(message)) !== null) {
    refs.push(match[1].trim());
  }
  const srcRegex =
    /(?:src|lib|app|components|utils|models|commands)\/[\w\-/]+/g;
  while ((match = srcRegex.exec(message)) !== null) {
    refs.push(match[0]);
  }
  return [...new Set(refs)];
}

// ─── Detect if user wants full project scan ───────────────────────────────────
export function wantsFullProjectScan(message: string): boolean {
  const triggers = [
    "fix everything", "fix all", "fix the project", "fix all errors",
    "fix all bugs", "fix all issues", "check everything", "review everything",
    "scan everything", "analyze everything", "analyse everything",
    "all files", "entire project", "whole project", "entire codebase",
    "whole codebase", "all the files", "go through everything",
    "go through the project", "fix the design", "fix design",
    "improve design", "update design", "change design", "redesign",
    "fix the ui", "fix the ux", "fix styling", "fix the styling",
    "improve the design", "update styling", "fix styles",
    "fix the colors", "fix the colours", "improve the colors",
    "change the colors", "update the colors", "fix the theme",
    "update the theme", "change the theme", "fix the display",
    "update the display", "improve the display", "fix the layout",
    "improve the layout", "update the layout", "make it look better",
    "make it prettier", "make it nicer", "improve the look",
    "improve the appearance", "better design", "looking at the",
    "looking at this", "this project", "this codebase",
    "fix the entire", "entire project",
  ];
  const lower = message.toLowerCase();
  return triggers.some((t) => lower.includes(t));
}

// ─── Detect specific file mentions ───────────────────────────────────────────
export function detectSpecificFiles(message: string): string[] {
  const files: string[] = [];
  const filePattern =
    /(?:fix|edit|update|check|read|show|review|open|look at|modify|repair|debug)\s+(?:the\s+)?([a-zA-Z0-9_\-./]+\.[a-zA-Z]+)/gi;
  let match;
  while ((match = filePattern.exec(message)) !== null) {
    files.push(match[1]);
  }
  const namedFile = /\b([a-zA-Z0-9_\-]+\.[a-zA-Z]{1,5})\b/g;
  while ((match = namedFile.exec(message)) !== null) {
    const ext = path.extname(match[1]).toLowerCase();
    const known = [
      ".ts", ".js", ".tsx", ".jsx", ".py", ".go", ".rs",
      ".json", ".md", ".txt", ".css", ".html", ".yml", ".yaml",
      ".java", ".c", ".cpp", ".cs", ".rb", ".php", ".sh",
    ];
    if (known.includes(ext)) files.push(match[1]);
  }
  return [...new Set(files)];
}

// ─── Find actual file path in project ────────────────────────────────────────
export function findFileInProject(
  filename: string,
  searchDir = "."
): string | null {
  if (fs.existsSync(filename)) return path.resolve(filename);
  if (fs.existsSync(path.resolve(filename)))
    return path.resolve(filename);
  const results = searchFileByName(filename, searchDir);
  if (results.length > 0) return results[0];
  const commonDirs = [
    "src", "lib", "app", "components", "utils",
    "models", "commands", "scripts", "styles", "public",
  ];
  for (const dir of commonDirs) {
    const attempt = path.join(dir, filename);
    if (fs.existsSync(attempt)) return path.resolve(attempt);
    const nested = searchFileByName(filename, dir);
    if (nested.length > 0) return nested[0];
  }
  return null;
}

function searchFileByName(
  filename: string,
  dir: string,
  depth = 0
): string[] {
  if (depth > 5 || !fs.existsSync(dir)) return [];
  const results: string[] = [];
  let items: string[];
  try {
    items = fs.readdirSync(dir);
  } catch {
    return [];
  }
  for (const item of items) {
    if (
      ["node_modules", "dist", ".git", "coverage", "__pycache__"].includes(
        item
      )
    )
      continue;
    const fullPath = path.join(dir, item);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...searchFileByName(filename, fullPath, depth + 1));
      } else if (
        item === filename ||
        item === path.basename(filename) ||
        item.toLowerCase() === filename.toLowerCase()
      ) {
        results.push(path.resolve(fullPath));
      }
    } catch {
      /* skip */
    }
  }
  return results;
}

// ─── Get all project source files ────────────────────────────────────────────
export function getAllProjectFiles(
  dir = ".",
  extensions = [
    ".ts", ".js", ".tsx", ".jsx", ".py", ".go",
    ".json", ".md", ".css", ".html", ".scss", ".sass", ".less",
  ]
): string[] {
  const files: string[] = [];
  function scan(currentDir: string, depth = 0): void {
    if (depth > 6) return;
    let items: string[];
    try {
      items = fs.readdirSync(currentDir);
    } catch {
      return;
    }
    for (const item of items) {
      if (
        [
          "node_modules", "dist", ".git", "coverage",
          "__pycache__", ".next", ".nuxt", "build", ".cache",
        ].includes(item) ||
        item.startsWith(".")
      )
        continue;
      const fullPath = path.join(currentDir, item);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scan(fullPath, depth + 1);
        } else if (
          extensions.includes(path.extname(item).toLowerCase())
        ) {
          files.push(fullPath);
        }
      } catch {
        /* skip */
      }
    }
  }
  scan(dir);
  return files;
}

// ─── Analyse which files are relevant ────────────────────────────────────────
export function analyseRelevantFiles(
  message: string,
  allFiles: string[]
): string[] {
  const lower = message.toLowerCase();
  const scored: Array<{ file: string; score: number }> = [];
  const keywords = lower.split(/\s+/).filter((w) => w.length > 3);

  for (const file of allFiles) {
    const basename = path.basename(file).toLowerCase();
    const ext = path.extname(file).toLowerCase();
    let score = 0;

    for (const kw of keywords) {
      if (basename.includes(kw)) score += 10;
    }

    if (
      lower.includes("design") ||
      lower.includes("style") ||
      lower.includes("ui") ||
      lower.includes("layout") ||
      lower.includes("color") ||
      lower.includes("colour") ||
      lower.includes("theme") ||
      lower.includes("display")
    ) {
      if ([".css", ".scss", ".sass", ".less", ".html"].includes(ext))
        score += 20;
      if (
        basename.includes("display") ||
        basename.includes("theme") ||
        basename.includes("style") ||
        basename.includes("color")
      )
        score += 15;
      if (
        basename.includes("component") ||
        basename.includes("layout") ||
        basename.includes("ui")
      )
        score += 10;
    }

    if (
      [
        "index.ts", "index.js", "main.ts",
        "main.js", "app.ts", "app.js",
      ].includes(basename)
    )
      score += 5;

    if (score > 0) scored.push({ file, score });
  }

  if (scored.length === 0) return allFiles;
  return scored.sort((a, b) => b.score - a.score).map((s) => s.file);
}

// ─── Build smart context for AI ──────────────────────────────────────────────
export async function buildSmartContext(
  message: string,
  currentDir = ".",
  onProgress?: (current: number, total: number, file: string) => void
): Promise<{
  context: string;
  filesFound: string[];
  isFullScan: boolean;
}> {
  const filesFound: string[] = [];
  let context = "";
  let isFullScan = false;

  const isLikelyBinary = (content: string): boolean => {
    const sample = content.slice(0, 200_000);
    for (let i = 0; i < sample.length; i++) {
      if (sample.charCodeAt(i) === 0) return true;
    }
    return false;
  };

  if (wantsFullProjectScan(message)) {
    isFullScan = true;
    const allFiles = getAllProjectFiles(currentDir);
    const relevantFiles = analyseRelevantFiles(message, allFiles);

    const parts: string[] = [];
    let totalChars = 0;

    // ── Reduced limits to prevent model termination ────────────────────────
    const MAX_CHARS = 40000;
    const MAX_FILE_CHARS = 6000;
    const MAX_FILES = 15;

    for (let i = 0; i < relevantFiles.length; i++) {
      if (totalChars >= MAX_CHARS) break;
      if (filesFound.length >= MAX_FILES) {
        printInfo(
          `Context limit: using ${MAX_FILES} most relevant files.`
        );
        break;
      }

      const filePath = relevantFiles[i];
      onProgress?.(
        i + 1,
        relevantFiles.length,
        path.relative(currentDir, filePath)
      );

      try {
        const result = readFile(filePath);
        if (!result.exists || !result.content?.trim()) continue;
        if (isLikelyBinary(result.content)) continue;

        const sliced =
          result.content.length > MAX_FILE_CHARS
            ? result.content.slice(0, MAX_FILE_CHARS) +
              "\n// ... (truncated for context limit)"
            : result.content;

        const rel = path.relative(currentDir, filePath);
        const block = `=== ${rel} ===\n${sliced}\n=== END ${rel} ===`;

        if (totalChars + block.length > MAX_CHARS) break;
        parts.push(block);
        filesFound.push(filePath);
        totalChars += block.length;
      } catch {
        /* skip */
      }
    }

    context = parts.join("\n\n");
  } else {
    const specificFiles = detectSpecificFiles(message);
    for (const filename of specificFiles) {
      const foundPath = findFileInProject(filename, currentDir);
      if (foundPath && !filesFound.includes(foundPath)) {
        try {
          const result = readFile(foundPath);
          if (result.exists) {
            const rel = path.relative(currentDir, foundPath);
            context += `=== ${rel} ===\n${result.content}\n=== END ${rel} ===\n\n`;
            filesFound.push(foundPath);
          }
        } catch {
          /* skip */
        }
      }
    }

    const pathRefs = extractFileRefs(message);
    for (const ref of pathRefs) {
      const foundPath = findFileInProject(ref, currentDir);
      if (foundPath && !filesFound.includes(foundPath)) {
        try {
          const result = readFile(foundPath);
          if (result.exists) {
            const rel = path.relative(currentDir, foundPath);
            context += `=== ${rel} ===\n${result.content}\n=== END ${rel} ===\n\n`;
            filesFound.push(foundPath);
          }
        } catch {
          /* skip */
        }
      }
    }
  }

  return { context, filesFound, isFullScan };
}

// ─── Parse AI response for file edit intentions ───────────────────────────────
export interface FileEditPlan {
  filename: string;
  relativePath: string;
  reason: string;
  isNew: boolean;
}

export function parseAIEditPlan(
  aiResponse: string,
  currentDir = "."
): FileEditPlan[] {
  const plans: FileEditPlan[] = [];
  const seen = new Set<string>();

  const codeBlockRegex =
    /```(?:\w+)?\s*\n(?:\/\/\s*|#\s*|<!--\s*)?([^\n]+\.[a-zA-Z]{1,10})[^\n]*\n[\s\S]*?```/g;
  let match;
  while ((match = codeBlockRegex.exec(aiResponse)) !== null) {
    const rawFilename = match[1].trim().replace(/-->.*$/, "").trim();
    if (seen.has(rawFilename)) continue;
    seen.add(rawFilename);
    const found = findFileInProject(rawFilename, currentDir);
    plans.push({
      filename: rawFilename,
      relativePath: found
        ? path.relative(currentDir, found)
        : rawFilename,
      reason: "AI provided updated content",
      isNew: !found || !fs.existsSync(found),
    });
  }

  const fileMarkerRegex =
    /(?:File:|###|──)\s+([a-zA-Z0-9_\-./]+\.[a-zA-Z]{1,10})/g;
  while ((match = fileMarkerRegex.exec(aiResponse)) !== null) {
    const rawFilename = match[1].trim();
    if (seen.has(rawFilename)) continue;
    seen.add(rawFilename);
    const found = findFileInProject(rawFilename, currentDir);
    plans.push({
      filename: rawFilename,
      relativePath: found
        ? path.relative(currentDir, found)
        : rawFilename,
      reason: "Identified in AI response",
      isNew: !found || !fs.existsSync(found),
    });
  }

  return plans;
}

// ─── Extract code blocks ──────────────────────────────────────────────────────
export interface ExtractedCode {
  filename: string | null;
  language: string;
  code: string;
}

export function extractCodeBlocks(aiResponse: string): ExtractedCode[] {
  const blocks: ExtractedCode[] = [];
  const codeBlockRegex = /```(?:(\w+))?\s*\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(aiResponse)) !== null) {
    const language = match[1] || "text";
    const code = (match[2] || "").trim();
    let filename: string | null = null;

    const firstLine = code.split("\n")[0];
    const filenameInCode = firstLine.match(
      /(?:\/\/|#|<!--)\s*([^\s,]+\.[a-zA-Z]{1,10})/
    );
    if (filenameInCode) {
      filename = filenameInCode[1].trim().replace(/-->.*$/, "").trim();
    }

    blocks.push({ filename, language, code });
  }

  const filenamePatterns = [
    /###\s+([^\n]+\.[a-z]+)/gi,
    /\*\*([^\n]+\.[a-z]+)\*\*/gi,
    /File:\s+([^\n]+\.[a-z]+)/gi,
    /`([^\n]+\.[a-z]+)`:/gi,
  ];

  for (let i = 0; i < blocks.length; i++) {
    if (!blocks[i].filename) {
      for (const pattern of filenamePatterns) {
        pattern.lastIndex = 0;
        const m = pattern.exec(aiResponse);
        if (m) {
          blocks[i].filename = m[1].trim();
          break;
        }
      }
    }
  }

  return blocks;
}

// ─── Apply AI fixes to files ──────────────────────────────────────────────────
export async function applyAIFixes(
  aiResponse: string,
  originalFiles: string[],
  currentDir = ".",
  onProgress?: (file: string, done: number, total: number) => void
): Promise<{ applied: string[]; skipped: string[]; backups: string[] }> {
  const applied: string[] = [];
  const skipped: string[] = [];
  const backups: string[] = [];

  const codeBlocks = extractCodeBlocks(aiResponse);
  if (codeBlocks.length === 0) return { applied, skipped, backups };

  const validBlocks = codeBlocks.filter(
    (b) => b.code.trim().length > 10
  );

  for (let i = 0; i < validBlocks.length; i++) {
    const block = validBlocks[i];
    let targetFile: string | null = null;

    if (block.filename) {
      targetFile = findFileInProject(block.filename, currentDir);
      if (!targetFile) {
        targetFile = path.resolve(currentDir, block.filename);
      }
    } else if (originalFiles.length === 1) {
      targetFile = originalFiles[0];
    } else {
      for (const orig of originalFiles) {
        const ext = path.extname(orig).toLowerCase();
        if (
          (block.language === "typescript" &&
            (ext === ".ts" || ext === ".tsx")) ||
          (block.language === "javascript" &&
            (ext === ".js" || ext === ".jsx")) ||
          (block.language === "python" && ext === ".py") ||
          (block.language === "json" && ext === ".json") ||
          (block.language === "css" && ext === ".css") ||
          (block.language === "scss" && ext === ".scss") ||
          (block.language === "html" && ext === ".html")
        ) {
          targetFile = orig;
          break;
        }
      }
    }

    if (targetFile) {
      const relPath = path.relative(currentDir, targetFile);
      onProgress?.(relPath, i + 1, validBlocks.length);

      try {
        if (fs.existsSync(targetFile)) {
          const backupPath = `${targetFile}.backup-${Date.now()}`;
          fs.copyFileSync(targetFile, backupPath);
          backups.push(path.relative(currentDir, backupPath));
        }

        const dir = path.dirname(targetFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(targetFile, block.code, "utf8");
        applied.push(relPath);
      } catch {
        skipped.push(block.filename || "unknown");
      }
    } else {
      if (block.filename) skipped.push(block.filename);
    }
  }

  return { applied, skipped, backups };
}

// ─── Preview fix targets ──────────────────────────────────────────────────────
export function previewAIFixesTargets(
  aiResponse: string,
  originalFiles: string[],
  currentDir = "."
): { targets: string[]; newFiles: string[] } {
  const targets = new Set<string>();
  const newFiles = new Set<string>();
  const codeBlocks = extractCodeBlocks(aiResponse);

  for (const block of codeBlocks) {
    if (!block.code.trim() || block.code.trim().length < 10) continue;
    let targetFile: string | null = null;

    if (block.filename) {
      const found = findFileInProject(block.filename, currentDir);
      targetFile = found || path.resolve(currentDir, block.filename);
    } else if (originalFiles.length === 1) {
      targetFile = originalFiles[0];
    } else {
      for (const orig of originalFiles) {
        const ext = path.extname(orig).toLowerCase();
        if (
          (block.language === "typescript" &&
            (ext === ".ts" || ext === ".tsx")) ||
          (block.language === "javascript" &&
            (ext === ".js" || ext === ".jsx")) ||
          (block.language === "python" && ext === ".py") ||
          (block.language === "json" && ext === ".json") ||
          (block.language === "css" && ext === ".css") ||
          (block.language === "scss" && ext === ".scss") ||
          (block.language === "html" && ext === ".html")
        ) {
          targetFile = orig;
          break;
        }
      }
    }

    if (!targetFile) continue;
    const rel = path.relative(currentDir, targetFile);
    if (fs.existsSync(targetFile)) targets.add(rel);
    else newFiles.add(rel);
  }

  return { targets: [...targets], newFiles: [...newFiles] };
}

// ─── Rich confirmation UI ─────────────────────────────────────────────────────
export function printEditConfirmation(
  filesToEdit: string[],
  filesToCreate: string[],
  summary: string
): void {
  const w = getWidth();
  const innerW = w - 4;

  console.log();
  console.log(
    `  ${chalk.hex("#7F1D1D")("╔")}${chalk.hex("#7F1D1D")(
      "═".repeat(w - 2)
    )}${chalk.hex("#7F1D1D")("╗")}`
  );
  console.log(
    `  ${chalk.hex("#7F1D1D")("║")} ${chalk.hex("#F59E0B")("✦")} ${chalk
      .hex("#F87171")
      .bold("AGENT EDIT PLAN")}${" ".repeat(
      Math.max(0, innerW - 17)
    )}${chalk.hex("#7F1D1D")("║")}`
  );
  console.log(
    `  ${chalk.hex("#7F1D1D")("╠")}${chalk.hex("#7F1D1D")(
      "═".repeat(w - 2)
    )}${chalk.hex("#7F1D1D")("╣")}`
  );

  if (summary.trim()) {
    const words = summary.replace(/\n/g, " ").split(" ");
    const summaryLines: string[] = [];
    let current = "";
    for (const word of words) {
      if (current.length + word.length + 1 > innerW - 2) {
        if (current) summaryLines.push(current);
        current = word;
      } else {
        current = current ? `${current} ${word}` : word;
      }
    }
    if (current) summaryLines.push(current);

    for (const line of summaryLines.slice(0, 4)) {
      console.log(
        `  ${chalk.hex("#7F1D1D")("║")} ${chalk.hex("#B3B3B3")(
          line.slice(0, innerW - 2).padEnd(innerW - 2)
        )} ${chalk.hex("#7F1D1D")("║")}`
      );
    }
    console.log(
      `  ${chalk.hex("#7F1D1D")("╠")}${chalk.hex("#7F1D1D")(
        "─".repeat(w - 2)
      )}${chalk.hex("#7F1D1D")("╣")}`
    );
  }

  if (filesToEdit.length > 0) {
    console.log(
      `  ${chalk.hex("#7F1D1D")("║")} ${chalk.hex("#F59E0B")(
        "✎ FILES TO EDIT:"
      )}${" ".repeat(
        Math.max(0, innerW - 16)
      )}${chalk.hex("#7F1D1D")("║")}`
    );
    for (const f of filesToEdit.slice(0, 10)) {
      const label = `  • ${f}`;
      console.log(
        `  ${chalk.hex("#7F1D1D")("║")} ${chalk.hex("#F87171")(
          label.slice(0, innerW - 2).padEnd(innerW - 2)
        )} ${chalk.hex("#7F1D1D")("║")}`
      );
    }
    if (filesToEdit.length > 10) {
      console.log(
        `  ${chalk.hex("#7F1D1D")("║")} ${chalk.hex("#666670")(
          `  … and ${filesToEdit.length - 10} more files`.padEnd(
            innerW - 2
          )
        )} ${chalk.hex("#7F1D1D")("║")}`
      );
    }
  }

  if (filesToCreate.length > 0) {
    console.log(
      `  ${chalk.hex("#7F1D1D")("╠")}${chalk.hex("#7F1D1D")(
        "─".repeat(w - 2)
      )}${chalk.hex("#7F1D1D")("╣")}`
    );
    console.log(
      `  ${chalk.hex("#7F1D1D")("║")} ${chalk.hex("#10B981")(
        "✦ NEW FILES:"
      )}${" ".repeat(
        Math.max(0, innerW - 12)
      )}${chalk.hex("#7F1D1D")("║")}`
    );
    for (const f of filesToCreate.slice(0, 5)) {
      const label = `  + ${f}`;
      console.log(
        `  ${chalk.hex("#7F1D1D")("║")} ${chalk.hex("#10B981")(
          label.slice(0, innerW - 2).padEnd(innerW - 2)
        )} ${chalk.hex("#7F1D1D")("║")}`
      );
    }
  }

  console.log(
    `  ${chalk.hex("#7F1D1D")("╠")}${chalk.hex("#7F1D1D")(
      "═".repeat(w - 2)
    )}${chalk.hex("#7F1D1D")("╣")}`
  );
  console.log(
    `  ${chalk.hex("#7F1D1D")("║")} ${chalk.hex("#F59E0B")("?")} ` +
      `${chalk.hex("#E6E6E6")("Apply these changes?")}  ` +
      `${chalk.hex("#10B981").bold("[Y]")}${chalk.hex("#E6E6E6")("es")}  ` +
      `${chalk.hex("#EF4444").bold("[N]")}${chalk.hex("#E6E6E6")("o")}  ` +
      `${chalk.hex("#F59E0B").bold("[S]")}${chalk.hex("#E6E6E6")(
        "how code"
      )}` +
      `${" ".repeat(Math.max(0, innerW - 38))}${chalk.hex("#7F1D1D")("║")}`
  );
  console.log(
    `  ${chalk.hex("#7F1D1D")("╚")}${chalk.hex("#7F1D1D")(
      "═".repeat(w - 2)
    )}${chalk.hex("#7F1D1D")("╝")}`
  );
  console.log();
}

// ─── Build system prompt ──────────────────────────────────────────────────────
export function buildAgentSystemPrompt(): string {
  return `You are PM-AI, an expert AI coding agent with direct access to the user's project files.

CRITICAL RULE — FILE EDITING:
When the user asks you to fix, edit, improve, redesign, or change ANY file or project:
- You MUST provide the complete updated file content in a code block
- You MUST include the EXACT filename as a comment on the FIRST LINE of every code block
- The system will automatically intercept your code blocks and write them to disk
- The user will be shown a confirmation prompt BEFORE any files are changed
- You MUST NOT provide partial snippets — always the COMPLETE file content
- You MUST NOT use "..." or "rest remains same" — include everything

CODE BLOCK FORMAT — STRICTLY REQUIRED:
\`\`\`typescript
// src/utils/display.ts
<complete file content here — never truncate>
\`\`\`

\`\`\`css
/* src/styles/main.css */
<complete file content>
\`\`\`

AFTER all code blocks write a SHORT summary of changes. Nothing else.

RULES:
1. Complete file content always — never truncate
2. Filename comment must be the absolute first line inside the code block
3. Fix ALL files that need changes in one response
4. If changing one file affects another — fix both
5. For design/display fixes: update ALL relevant files
6. Create new files if needed
7. Be concise — do not over-explain

THINKING PROCESS:
1. Analyze ALL provided file contents
2. Identify EVERY file that needs changing
3. Output ALL changed files as complete code blocks
4. Write brief summary`;
}