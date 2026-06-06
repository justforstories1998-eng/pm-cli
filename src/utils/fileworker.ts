import fs from "fs";
import path from "path";
import readline from "readline";

export interface FileReadResult {
  path: string;
  content: string;
  lines: number;
  size: number;
  extension: string;
  exists: boolean;
}

export interface FileEditResult {
  success: boolean;
  path: string;
  message: string;
  backup?: string;
}

export interface DirectoryResult {
  path: string;
  entries: DirectoryEntry[];
  total: number;
}

export interface DirectoryEntry {
  name: string;
  type: "file" | "directory";
  size?: number;
  extension?: string;
  path: string;
}

export interface SearchResult {
  file: string;
  line: number;
  content: string;
  match: string;
}

// ─── READ FILE ────────────────────────────────────────────────────────────────
export function readFile(filePath: string): FileReadResult {
  const resolved = path.resolve(filePath);
  const ext = path.extname(resolved).toLowerCase();

  if (!fs.existsSync(resolved)) {
    return {
      path: resolved,
      content: "",
      lines: 0,
      size: 0,
      extension: ext,
      exists: false,
    };
  }

  const stats = fs.statSync(resolved);

  if (stats.size > 10 * 1024 * 1024) {
    throw new Error(`File too large to read (max 10MB): ${resolved}`);
  }

  const content = fs.readFileSync(resolved, "utf8");
  const lines = content.split("\n").length;

  return {
    path: resolved,
    content,
    lines,
    size: stats.size,
    extension: ext,
    exists: true,
  };
}

// ─── WRITE FILE ───────────────────────────────────────────────────────────────
export function writeFile(
  filePath: string,
  content: string,
  backup: boolean = true
): FileEditResult {
  const resolved = path.resolve(filePath);
  const dir = path.dirname(resolved);

  // Create directories if they don't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let backupPath: string | undefined;

  // Backup existing file
  if (backup && fs.existsSync(resolved)) {
    backupPath = `${resolved}.backup.${Date.now()}`;
    fs.copyFileSync(resolved, backupPath);
  }

  fs.writeFileSync(resolved, content, "utf8");

  return {
    success: true,
    path: resolved,
    message: `File written: ${resolved}`,
    backup: backupPath,
  };
}

// ─── APPEND TO FILE ───────────────────────────────────────────────────────────
export function appendToFile(filePath: string, content: string): FileEditResult {
  const resolved = path.resolve(filePath);
  const dir = path.dirname(resolved);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.appendFileSync(resolved, content, "utf8");

  return {
    success: true,
    path: resolved,
    message: `Content appended to: ${resolved}`,
  };
}

// ─── DELETE FILE ──────────────────────────────────────────────────────────────
export function deleteFile(filePath: string): FileEditResult {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    return {
      success: false,
      path: resolved,
      message: `File not found: ${resolved}`,
    };
  }

  // Backup before delete
  const backupPath = `${resolved}.deleted.${Date.now()}`;
  fs.copyFileSync(resolved, backupPath);
  fs.unlinkSync(resolved);

  return {
    success: true,
    path: resolved,
    message: `File deleted (backup at: ${backupPath})`,
    backup: backupPath,
  };
}

// ─── EDIT SPECIFIC LINES ──────────────────────────────────────────────────────
export function editLines(
  filePath: string,
  startLine: number,
  endLine: number,
  newContent: string
): FileEditResult {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    return {
      success: false,
      path: resolved,
      message: `File not found: ${resolved}`,
    };
  }

  const content = fs.readFileSync(resolved, "utf8");
  const lines = content.split("\n");

  const start = Math.max(0, startLine - 1);
  const end = Math.min(lines.length, endLine);

  const newLines = newContent.split("\n");
  lines.splice(start, end - start, ...newLines);

  const backupPath = `${resolved}.backup.${Date.now()}`;
  fs.copyFileSync(resolved, backupPath);
  fs.writeFileSync(resolved, lines.join("\n"), "utf8");

  return {
    success: true,
    path: resolved,
    message: `Lines ${startLine}-${endLine} updated in: ${resolved}`,
    backup: backupPath,
  };
}

// ─── FIND AND REPLACE ─────────────────────────────────────────────────────────
export function findAndReplace(
  filePath: string,
  find: string,
  replace: string,
  allOccurrences: boolean = true
): FileEditResult & { count: number } {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    return {
      success: false,
      path: resolved,
      message: `File not found: ${resolved}`,
      count: 0,
    };
  }

  let content = fs.readFileSync(resolved, "utf8");
  const backupPath = `${resolved}.backup.${Date.now()}`;
  fs.copyFileSync(resolved, backupPath);

  let count = 0;
  if (allOccurrences) {
    const regex = new RegExp(escapeRegex(find), "g");
    content = content.replace(regex, () => { count++; return replace; });
  } else {
    if (content.includes(find)) {
      content = content.replace(find, replace);
      count = 1;
    }
  }

  fs.writeFileSync(resolved, content, "utf8");

  return {
    success: true,
    path: resolved,
    message: `Replaced ${count} occurrence(s) in: ${resolved}`,
    backup: backupPath,
    count,
  };
}

// ─── LIST DIRECTORY ───────────────────────────────────────────────────────────
export function listDirectory(
  dirPath: string = ".",
  recursive: boolean = false,
  maxDepth: number = 3
): DirectoryResult {
  const resolved = path.resolve(dirPath);

  if (!fs.existsSync(resolved)) {
    return { path: resolved, entries: [], total: 0 };
  }

  const entries: DirectoryEntry[] = [];

  function scan(dir: string, depth: number): void {
    if (depth > maxDepth) return;

    let items: string[];
    try {
      items = fs.readdirSync(dir);
    } catch {
      return;
    }

    // Sort: directories first, then files
    const sorted = items.sort((a, b) => {
      const aPath = path.join(dir, a);
      const bPath = path.join(dir, b);
      const aIsDir = fs.statSync(aPath).isDirectory();
      const bIsDir = fs.statSync(bPath).isDirectory();
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.localeCompare(b);
    });

    for (const item of sorted) {
      // Skip hidden and system folders
      if (
        item.startsWith(".") ||
        item === "node_modules" ||
        item === "dist" ||
        item === "__pycache__" ||
        item === ".git"
      ) continue;

      const fullPath = path.join(dir, item);
      const relativePath = path.relative(resolved, fullPath);

      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          entries.push({
            name: item,
            type: "directory",
            path: relativePath,
          });
          if (recursive) scan(fullPath, depth + 1);
        } else {
          entries.push({
            name: item,
            type: "file",
            size: stat.size,
            extension: path.extname(item).toLowerCase(),
            path: relativePath,
          });
        }
      } catch {
        // skip files we can't access
      }
    }
  }

  scan(resolved, 0);
  return { path: resolved, entries, total: entries.length };
}

// ─── SEARCH IN FILES ──────────────────────────────────────────────────────────
export function searchInFiles(
  dirPath: string,
  query: string,
  extensions: string[] = [".ts", ".js", ".json", ".md", ".txt", ".py", ".go"]
): SearchResult[] {
  const resolved = path.resolve(dirPath);
  const results: SearchResult[] = [];

  if (!fs.existsSync(resolved)) return results;

  function searchFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            file: path.relative(resolved, filePath),
            line: idx + 1,
            content: line.trim(),
            match: query,
          });
        }
      });
    } catch {
      // skip unreadable files
    }
  }

  function scanDir(dir: string, depth: number = 0): void {
    if (depth > 5) return;
    let items: string[];
    try {
      items = fs.readdirSync(dir);
    } catch {
      return;
    }

    for (const item of items) {
      if (
        item.startsWith(".") ||
        item === "node_modules" ||
        item === "dist" ||
        item === ".git"
      ) continue;

      const fullPath = path.join(dir, item);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanDir(fullPath, depth + 1);
        } else {
          const ext = path.extname(item).toLowerCase();
          if (extensions.includes(ext)) {
            searchFile(fullPath);
          }
        }
      } catch {
        // skip
      }
    }
  }

  scanDir(resolved);
  return results;
}

// ─── CREATE DIRECTORY ─────────────────────────────────────────────────────────
export function createDirectory(dirPath: string): FileEditResult {
  const resolved = path.resolve(dirPath);

  if (fs.existsSync(resolved)) {
    return {
      success: false,
      path: resolved,
      message: `Directory already exists: ${resolved}`,
    };
  }

  fs.mkdirSync(resolved, { recursive: true });
  return {
    success: true,
    path: resolved,
    message: `Directory created: ${resolved}`,
  };
}

// ─── GET FILE PREVIEW (first N lines) ────────────────────────────────────────
export function previewFile(filePath: string, lines: number = 50): string {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return `File not found: ${resolved}`;

  const content = fs.readFileSync(resolved, "utf8");
  const allLines = content.split("\n");
  const preview = allLines.slice(0, lines);
  const hasMore = allLines.length > lines;

  return preview.join("\n") + (hasMore ? `\n\n... (${allLines.length - lines} more lines)` : "");
}

// ─── BUILD FILE CONTEXT FOR AI ───────────────────────────────────────────────
export function buildFileContext(filePaths: string[]): string {
  const parts: string[] = [];

  for (const filePath of filePaths) {
    const result = readFile(filePath);
    if (result.exists) {
      parts.push(
        `=== FILE: ${result.path} (${result.lines} lines) ===\n${result.content}\n=== END: ${result.path} ===`
      );
    } else {
      parts.push(`=== FILE: ${filePath} — NOT FOUND ===`);
    }
  }

  return parts.join("\n\n");
}

// ─── FORMAT FILE SIZE ────────────────────────────────────────────────────────
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}