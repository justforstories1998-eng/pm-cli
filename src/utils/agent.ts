import fs from "fs";
import path from "path";
import {
  readFile,
  writeFile,
  listDirectory,
  searchInFiles,
  buildFileContext,
  DirectoryEntry,
} from "./fileworker";
import { printInfo, printSuccess, printError, printWarning, C } from "./display";

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

// ─── Detect if message needs file operations ──────────────────────────────────
export function needsFileAccess(message: string): boolean {
  const triggers = [
    // Fix patterns
    "fix", "repair", "correct", "debug", "solve", "resolve",
    // Edit patterns
    "edit", "update", "change", "modify", "refactor", "improve",
    "rewrite", "add", "remove", "delete", "rename",
    // Read patterns
    "read", "show", "display", "open", "look at", "check",
    "review", "analyze", "analyse", "explain", "understand",
    // Project patterns
    "project", "codebase", "all files", "everything",
    "directory", "folder", "file",
    // Extension patterns
    ".ts", ".js", ".py", ".json", ".md", ".txt", ".css", ".html",
    // Code patterns
    "function", "class", "component", "module", "import",
    "error", "bug", "issue", "problem", "warning",
  ];

  const lower = message.toLowerCase();
  return triggers.some((t) => lower.includes(t));
}

// ─── Extract file references from message ────────────────────────────────────
export function extractFileRefs(message: string): string[] {
  const refs: string[] = [];

  // Match file paths with extensions
  const pathRegex = /(?:^|\s)((?:[\w\-./\\]+\/)*[\w\-]+\.\w+)/g;
  let match;
  while ((match = pathRegex.exec(message)) !== null) {
    refs.push(match[1].trim());
  }

  // Match src/xxx patterns without extension
  const srcRegex = /(?:src|lib|app|components|utils|models|commands)\/[\w\-/]+/g;
  while ((match = srcRegex.exec(message)) !== null) {
    refs.push(match[0]);
  }

  return [...new Set(refs)];
}

// ─── Detect if user wants to fix everything ───────────────────────────────────
export function wantsFullProjectScan(message: string): boolean {
  const fullScanTriggers = [
    "fix everything",
    "fix all",
    "fix the project",
    "fix all errors",
    "fix all bugs",
    "fix all issues",
    "check everything",
    "review everything",
    "scan everything",
    "analyze everything",
    "analyse everything",
    "all files",
    "entire project",
    "whole project",
    "entire codebase",
    "whole codebase",
    "all the files",
    "go through everything",
    "go through the project",
  ];
  const lower = message.toLowerCase();
  return fullScanTriggers.some((t) => lower.includes(t));
}

// ─── Detect specific file mentions ───────────────────────────────────────────
export function detectSpecificFiles(message: string): string[] {
  const files: string[] = [];
  const lower = message.toLowerCase();

  // Patterns like "fix history.ts" or "fix the history.ts file"
  const filePattern = /(?:fix|edit|update|check|read|show|review|open|look at|modify|repair|debug)\s+(?:the\s+)?([a-zA-Z0-9_\-./]+\.[a-zA-Z]+)/gi;
  let match;
  while ((match = filePattern.exec(message)) !== null) {
    files.push(match[1]);
  }

  // Pattern: "the history.ts file" or "history.ts"
  const namedFile = /\b([a-zA-Z0-9_\-]+\.[a-zA-Z]{1,5})\b/g;
  while ((match = namedFile.exec(message)) !== null) {
    const ext = path.extname(match[1]).toLowerCase();
    const knownExts = [
      ".ts", ".js", ".tsx", ".jsx", ".py", ".go", ".rs",
      ".json", ".md", ".txt", ".css", ".html", ".yml", ".yaml",
      ".java", ".c", ".cpp", ".cs", ".rb", ".php", ".sh",
    ];
    if (knownExts.includes(ext)) {
      files.push(match[1]);
    }
  }

  return [...new Set(files)];
}

// ─── Find actual file path in project ────────────────────────────────────────
export function findFileInProject(
  filename: string,
  searchDir: string = "."
): string | null {
  // If it's already a valid path
  if (fs.existsSync(filename)) return path.resolve(filename);
  if (fs.existsSync(path.resolve(filename))) return path.resolve(filename);

  // Search recursively
  const results = searchFileByName(filename, searchDir);
  if (results.length > 0) return results[0];

  // Try common directories
  const commonDirs = ["src", "lib", "app", "components", "utils", "models", "commands", "scripts"];
  for (const dir of commonDirs) {
    const attempt = path.join(dir, filename);
    if (fs.existsSync(attempt)) return path.resolve(attempt);

    // Try nested
    const nested = searchFileByName(filename, dir);
    if (nested.length > 0) return nested[0];
  }

  return null;
}

function searchFileByName(filename: string, dir: string, depth: number = 0): string[] {
  if (depth > 5) return [];
  const results: string[] = [];

  if (!fs.existsSync(dir)) return [];

  let items: string[];
  try {
    items = fs.readdirSync(dir);
  } catch {
    return [];
  }

  for (const item of items) {
    if (item === "node_modules" || item === "dist" || item === ".git") continue;

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
      // skip
    }
  }

  return results;
}

// ─── Get all project source files ────────────────────────────────────────────
export function getAllProjectFiles(
  dir: string = ".",
  extensions: string[] = [".ts", ".js", ".tsx", ".jsx", ".py", ".go", ".json", ".md"]
): string[] {
  const files: string[] = [];

  function scan(currentDir: string, depth: number = 0): void {
    if (depth > 6) return;

    let items: string[];
    try {
      items = fs.readdirSync(currentDir);
    } catch {
      return;
    }

    for (const item of items) {
      if (
        item === "node_modules" ||
        item === "dist" ||
        item === ".git" ||
        item === "coverage" ||
        item === "__pycache__" ||
        item.startsWith(".")
      ) continue;

      const fullPath = path.join(currentDir, item);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scan(fullPath, depth + 1);
        } else {
          const ext = path.extname(item).toLowerCase();
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      } catch {
        // skip
      }
    }
  }

  scan(dir);
  return files;
}

// ─── Build smart context for AI ──────────────────────────────────────────────
export async function buildSmartContext(
  message: string,
  currentDir: string = "."
): Promise<{
  context: string;
  filesFound: string[];
  isFullScan: boolean;
}> {
  const filesFound: string[] = [];
  let context = "";
  let isFullScan = false;

  // Check if full project scan needed
  if (wantsFullProjectScan(message)) {
    isFullScan = true;
    printInfo("Scanning entire project…");

    const allFiles = getAllProjectFiles(currentDir);
    printInfo(`Found ${allFiles.length} source files…`);

    const parts: string[] = [];
    let totalChars = 0;
    const MAX_CHARS = 80000; // ~20k tokens

    for (const filePath of allFiles) {
      try {
        const result = readFile(filePath);
        if (result.exists && result.content.trim()) {
          const relativePath = path.relative(currentDir, filePath);
          const block = `=== ${relativePath} ===\n${result.content}\n=== END ${relativePath} ===`;

          if (totalChars + block.length > MAX_CHARS) {
            printInfo(`Context limit reached. Included ${parts.length}/${allFiles.length} files.`);
            break;
          }

          parts.push(block);
          filesFound.push(filePath);
          totalChars += block.length;
        }
      } catch {
        // skip unreadable files
      }
    }

    context = parts.join("\n\n");

  } else {
    // Look for specific files mentioned
    const specificFiles = detectSpecificFiles(message);

    if (specificFiles.length > 0) {
      printInfo(`Looking for: ${specificFiles.join(", ")}…`);

      for (const filename of specificFiles) {
        const foundPath = findFileInProject(filename, currentDir);
        if (foundPath) {
          try {
            const result = readFile(foundPath);
            if (result.exists) {
              const relativePath = path.relative(currentDir, foundPath);
              context += `=== ${relativePath} ===\n${result.content}\n=== END ${relativePath} ===\n\n`;
              filesFound.push(foundPath);
              printInfo(`Found: ${relativePath}`);
            }
          } catch {
            // skip
          }
        } else {
          printWarning(`Could not find: ${filename}`);
        }
      }
    }

    // Also check explicit paths in message
    const pathRefs = extractFileRefs(message);
    for (const ref of pathRefs) {
      if (!filesFound.includes(path.resolve(ref))) {
        const foundPath = findFileInProject(ref, currentDir);
        if (foundPath && !filesFound.includes(foundPath)) {
          try {
            const result = readFile(foundPath);
            if (result.exists) {
              const relativePath = path.relative(currentDir, foundPath);
              context += `=== ${relativePath} ===\n${result.content}\n=== END ${relativePath} ===\n\n`;
              filesFound.push(foundPath);
            }
          } catch {
            // skip
          }
        }
      }
    }
  }

  return { context, filesFound, isFullScan };
}

// ─── Parse AI response to extract code blocks ─────────────────────────────────
export interface ExtractedCode {
  filename: string | null;
  language: string;
  code: string;
}

export function extractCodeBlocks(aiResponse: string): ExtractedCode[] {
  const blocks: ExtractedCode[] = [];

  // Match ``` code blocks with optional language and filename
  const codeBlockRegex = /```(?:(\w+))?\s*(?:\/\/\s*(.+?)\n|\/\*\s*(.+?)\s*\*\/\n)?([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(aiResponse)) !== null) {
    const language = match[1] || "text";
    const filenameHint = match[2] || match[3] || null;
    const code = match[4].trim();

    blocks.push({
      filename: filenameHint,
      language,
      code,
    });
  }

  // Also try to find filename from surrounding context
  // Pattern: "### filename.ts" or "**filename.ts**" or "File: filename.ts"
  const filenamePatterns = [
    /###\s+([^\n]+\.[a-z]+)/gi,
    /\*\*([^\n]+\.[a-z]+)\*\*/gi,
    /File:\s+([^\n]+\.[a-z]+)/gi,
    /`([^\n]+\.[a-z]+)`:/gi,
    /\/\/\s+([^\n]+\.[a-z]+)/gi,
  ];

  // Try to associate filenames with blocks
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
  currentDir: string = "."
): Promise<{ applied: string[]; skipped: string[] }> {
  const applied: string[] = [];
  const skipped: string[] = [];

  const codeBlocks = extractCodeBlocks(aiResponse);

  if (codeBlocks.length === 0) {
    return { applied, skipped };
  }

  for (const block of codeBlocks) {
    if (!block.code.trim()) continue;

    let targetFile: string | null = null;

    // Try to match block to original file
    if (block.filename) {
      targetFile = findFileInProject(block.filename, currentDir);
      if (!targetFile) {
        // It might be a new file
        targetFile = path.resolve(block.filename);
      }
    } else if (originalFiles.length === 1) {
      // Only one file was sent — this fix is for that file
      targetFile = originalFiles[0];
    } else if (originalFiles.length > 1) {
      // Try to match by language/extension
      for (const orig of originalFiles) {
        const ext = path.extname(orig).toLowerCase();
        if (
          (block.language === "typescript" && ext === ".ts") ||
          (block.language === "javascript" && ext === ".js") ||
          (block.language === "python" && ext === ".py") ||
          (block.language === "json" && ext === ".json")
        ) {
          targetFile = orig;
          break;
        }
      }
    }

    if (targetFile) {
      try {
        writeFile(targetFile, block.code, true);
        const relative = path.relative(currentDir, targetFile);
        applied.push(relative);
      } catch (err) {
        skipped.push(block.filename || "unknown");
      }
    }
  }

  return { applied, skipped };
}

// ─── Build system prompt for coding agent ─────────────────────────────────────
export function buildAgentSystemPrompt(): string {
  return `You are an expert AI coding assistant with direct access to the user's project files.

When asked to fix, edit, or update code:
1. Read the provided file contents carefully
2. Identify ALL issues (syntax errors, logic bugs, type errors, missing imports, etc.)
3. Provide the COMPLETE fixed file content in a code block
4. Format your code blocks like this:

\`\`\`typescript
// src/utils/history.ts
<complete file content here>
\`\`\`

IMPORTANT RULES:
- Always include the complete file content, never partial snippets
- Include the filename as a comment on the first line of the code block
- Fix ALL issues you find, not just the ones mentioned
- Preserve existing functionality while fixing bugs
- Add proper TypeScript types where missing
- If fixing multiple files, provide each file in its own code block
- After the code, briefly explain what you fixed

When analyzing projects:
- Look for type errors, missing imports, logic bugs
- Check for consistency across files
- Identify unused variables and dead code
- Suggest performance improvements`;
}