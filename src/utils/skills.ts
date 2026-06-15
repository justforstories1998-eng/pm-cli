import fs from "fs";
import path from "path";
import os from "os";
import mime from "mime-types";
import { readFile as readTextFile } from "./fileworker";

function getSkillsRoot(): string {
  const home =
    process.platform === "win32"
      ? process.env.USERPROFILE || os.homedir()
      : os.homedir();
  return path.join(home, ".pm-ai-cli", "skills");
}

function getSkillDir(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9_\-]/g, "_");
  return path.join(getSkillsRoot(), safe);
}

function ensureDir(p: string): void {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function copyFileSync(src: string, dest: string): void {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDirRecursiveSync(srcDir: string, destDir: string): void {
  ensureDir(destDir);
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(srcDir, entry.name);
    const d = path.join(destDir, entry.name);
    if (entry.isDirectory()) copyDirRecursiveSync(s, d);
    else if (entry.isFile()) copyFileSync(s, d);
  }
}

export function listSkills(): string[] {
  const root = getSkillsRoot();
  if (!fs.existsSync(root)) return [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

export async function uploadSkill(
  name: string,
  sourcePath: string
): Promise<{ storedSkillName: string; copied: number; rootDir: string }> {
  const storedSkillName = name.replace(/[^a-zA-Z0-9_\-]/g, "_");
  const skillDir = getSkillDir(storedSkillName);
  ensureDir(skillDir);

  const resolved = path.resolve(sourcePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Skill source not found: ${resolved}`);
  }

  let copied = 0;
  const stat = fs.statSync(resolved);

  if (stat.isFile()) {
    const dest = path.join(skillDir, path.basename(resolved));
    copyFileSync(resolved, dest);
    copied = 1;
  } else if (stat.isDirectory()) {
    // Copy contents into skillDir
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    for (const entry of entries) {
      const s = path.join(resolved, entry.name);
      const d = path.join(skillDir, entry.name);
      if (entry.isDirectory()) {
        copyDirRecursiveSync(s, d);
      } else if (entry.isFile()) {
        copyFileSync(s, d);
        copied++;
      }
    }
    // For directories, copied is “files copied” tracked approximately; ok.
  } else {
    throw new Error(`Unsupported skill source type: ${resolved}`);
  }

  return { storedSkillName, copied, rootDir: skillDir };
}

function isProbablyTextExt(ext: string): boolean {
  const t = ext.toLowerCase();
  return [
    ".txt",
    ".md",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".xml",
    ".csv",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".go",
    ".rs",
    ".rb",
    ".php",
    ".css",
    ".scss",
    ".less",
    ".html",
    ".vue",
    ".svelte",
    ".config",
    ".env",
    ".ini",
    ".sh",
    ".bash",
    ".zsh",
  ].includes(t);
}

export function buildSkillContext(
  name: string,
  maxChars = 30000
): { context: string; filesIncluded: string[]; missing?: string } {
  const stored = name.replace(/[^a-zA-Z0-9_\-]/g, "_");
  const dir = getSkillDir(stored);
  if (!fs.existsSync(dir)) {
    return { context: "", filesIncluded: [], missing: `Skill not found: ${stored}` };
  }

  const parts: string[] = [];
  const filesIncluded: string[] = [];
  let total = 0;

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const rel = path.relative(dir, full).replace(/\\/g, "/");
        const ext = path.extname(full);
        const size = fs.statSync(full).size;

        // Limit “binary-ish” or huge files
        if (size > 2 * 1024 * 1024) continue;

        const mimeType = mime.lookup(full) || "";
        const extLower = ext.toLowerCase();

        if (isProbablyTextExt(extLower)) {
          try {
            const raw = fs.readFileSync(full, "utf8");
            const sliced =
              raw.length > 8000
                ? raw.slice(0, 8000) + "\n\n[... truncated ...]"
                : raw;

            const block = `=== Skill File: ${rel} (mime: ${mimeType || "text"}) ===\n${sliced}\n=== End Skill File: ${rel} ===`;

            if (total + block.length > maxChars) return;
            parts.push(block);
            filesIncluded.push(rel);
            total += block.length;
          } catch {
            // skip unreadable
          }
        } else {
          // Provide placeholder for non-text formats
          const placeholder = `=== Skill Binary: ${rel} (type: ${extLower || "unknown"}, mime: ${mimeType || "unknown"}) ===\n[No text extracted for this file format]\n=== End Skill Binary: ${rel} ===`;
          if (total + placeholder.length > maxChars) return;
          parts.push(placeholder);
          filesIncluded.push(rel);
          total += placeholder.length;
        }
      }
    }
  }

  walk(dir);

  return { context: parts.join("\n\n"), filesIncluded };
}

export function getSkillDirPath(name: string): string {
  return getSkillDir(name.replace(/[^a-zA-Z0-9_\-]/g, "_"));
}
