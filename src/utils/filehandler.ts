import fs from "fs";
import path from "path";
import mime from "mime-types";

export interface ProcessedFile {
  name: string;
  mimeType: string;
  size: number;
  type: "image" | "pdf" | "docx" | "xlsx" | "zip" | "text" | "other";
  textContent?: string;
  base64Data?: string;
  originalPath: string;
}

export interface ClipboardImage {
  base64Data: string;
  mimeType: string;
  size: number;
}

const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".tiff",
];
const TEXT_EXTENSIONS = [
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".xml",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".cfg",
  ".conf",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".py",
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".go",
  ".rs",
  ".rb",
  ".php",
  ".swift",
  ".kt",
  ".r",
  ".sql",
  ".html",
  ".css",
  ".scss",
  ".less",
  ".vue",
  ".svelte",
];

export async function processFile(filePath: string): Promise<ProcessedFile> {
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const stats = fs.statSync(resolvedPath);
  const ext = path.extname(resolvedPath).toLowerCase();
  const name = path.basename(resolvedPath);
  const mimeType =
    mime.lookup(resolvedPath) || "application/octet-stream";
  const size = stats.size;

  if (size > 50 * 1024 * 1024) {
    throw new Error(`File too large (max 50MB): ${name}`);
  }

  if (IMAGE_EXTENSIONS.includes(ext)) {
    const buffer = fs.readFileSync(resolvedPath);
    const base64Data = buffer.toString("base64");
    return {
      name,
      mimeType,
      size,
      type: "image",
      base64Data,
      originalPath: resolvedPath,
    };
  }

  if (ext === ".pdf") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require("pdf-parse");
      const buffer = fs.readFileSync(resolvedPath);
      const data = await pdfParse(buffer);
      return {
        name,
        mimeType,
        size,
        type: "pdf",
        textContent: data.text,
        originalPath: resolvedPath,
      };
    } catch (_err) {
      const buffer = fs.readFileSync(resolvedPath);
      return {
        name,
        mimeType,
        size,
        type: "pdf",
        textContent: `[PDF file: ${name}. Could not extract text - binary content]`,
        originalPath: resolvedPath,
      };
    }
  }

  if (ext === ".docx") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ path: resolvedPath });
      return {
        name,
        mimeType,
        size,
        type: "docx",
        textContent: result.value,
        originalPath: resolvedPath,
      };
    } catch (_err) {
      return {
        name,
        mimeType,
        size,
        type: "docx",
        textContent: `[DOCX file: ${name}. Could not extract text]`,
        originalPath: resolvedPath,
      };
    }
  }

  if (ext === ".xlsx" || ext === ".xls" || ext === ".ods") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const XLSX = require("xlsx");
      const workbook = XLSX.readFile(resolvedPath);
      const sheets: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        sheets.push(`=== Sheet: ${sheetName} ===\n${csv}`);
      }
      return {
        name,
        mimeType,
        size,
        type: "xlsx",
        textContent: sheets.join("\n\n"),
        originalPath: resolvedPath,
      };
    } catch (_err) {
      return {
        name,
        mimeType,
        size,
        type: "xlsx",
        textContent: `[Excel file: ${name}. Could not extract data]`,
        originalPath: resolvedPath,
      };
    }
  }

  if (ext === ".zip" || ext === ".tar" || ext === ".gz" || ext === ".rar") {
    try {
      if (ext === ".zip") {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const AdmZip = require("adm-zip");
        const zip = new AdmZip(resolvedPath);
        const entries = zip.getEntries();
        const listing = entries
          .slice(0, 100)
          .map(
            (e: { entryName: string; header: { size: number } }) =>
              `  ${e.entryName} (${formatBytes(e.header.size)})`
          )
          .join("\n");
        const truncated = entries.length > 100 ? `\n  ... and ${entries.length - 100} more files` : "";
        return {
          name,
          mimeType,
          size,
          type: "zip",
          textContent: `ZIP Archive: ${name}\nContents (${entries.length} files):\n${listing}${truncated}`,
          originalPath: resolvedPath,
        };
      }
      return {
        name,
        mimeType,
        size,
        type: "zip",
        textContent: `[Archive file: ${name}]`,
        originalPath: resolvedPath,
      };
    } catch (_err) {
      return {
        name,
        mimeType,
        size,
        type: "zip",
        textContent: `[Archive file: ${name}]`,
        originalPath: resolvedPath,
      };
    }
  }

  if (TEXT_EXTENSIONS.includes(ext)) {
    const content = fs.readFileSync(resolvedPath, "utf8");
    const truncated =
      content.length > 100000 ? content.slice(0, 100000) + "\n\n[... truncated at 100KB ...]" : content;
    return {
      name,
      mimeType,
      size,
      type: "text",
      textContent: truncated,
      originalPath: resolvedPath,
    };
  }

  // Other binary files
  return {
    name,
    mimeType,
    size,
    type: "other",
    textContent: `[Binary file: ${name} (${mimeType}, ${formatBytes(size)})]`,
    originalPath: resolvedPath,
  };
}

export function buildMessageWithFiles(
  userText: string,
  files: ProcessedFile[]
): { text: string; images: Array<{ base64: string; mimeType: string }> } {
  const images: Array<{ base64: string; mimeType: string }> = [];
  const textParts: string[] = [];

  if (userText.trim()) {
    textParts.push(userText.trim());
  }

  for (const file of files) {
    if (file.type === "image" && file.base64Data) {
      images.push({ base64: file.base64Data, mimeType: file.mimeType });
      textParts.push(`[Image attached: ${file.name}]`);
    } else if (file.textContent) {
      textParts.push(
        `\n\n--- File: ${file.name} ---\n${file.textContent}\n--- End of ${file.name} ---`
      );
    }
  }

  return { text: textParts.join("\n"), images };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export async function getClipboardImage(): Promise<ClipboardImage | null> {
  return new Promise((resolve) => {
    if (process.platform === "darwin") {
      const { execSync } = require("child_process");
      try {
        const script = `
          set imgFile to (path to temporary items as text) & "pm_clip_img.png"
          try
            set theImage to (the clipboard as «class PNGf»)
            set fileRef to open for access file imgFile with write permission
            set eof of fileRef to 0
            write theImage to fileRef
            close access fileRef
            return POSIX path of file imgFile
          on error
            return ""
          end try
        `;
        const result = execSync(`osascript -e '${script}'`, {
          encoding: "utf8",
          timeout: 5000,
        }).trim();
        if (result && fs.existsSync(result)) {
          const buffer = fs.readFileSync(result);
          fs.unlinkSync(result);
          resolve({
            base64Data: buffer.toString("base64"),
            mimeType: "image/png",
            size: buffer.length,
          });
        } else {
          resolve(null);
        }
      } catch (_) {
        resolve(null);
      }
    } else if (process.platform === "win32") {
      try {
        const { execSync } = require("child_process");
        const tmpFile = path.join(require("os").tmpdir(), "pm_clip_img.png");
        const psScript = `
          Add-Type -AssemblyName System.Windows.Forms
          $img = [System.Windows.Forms.Clipboard]::GetImage()
          if ($img -ne $null) {
            $img.Save('${tmpFile.replace(/\\/g, "\\\\")}', [System.Drawing.Imaging.ImageFormat]::Png)
            Write-Output "ok"
          } else {
            Write-Output "none"
          }
        `;
        const result = execSync(`powershell -Command "${psScript}"`, {
          encoding: "utf8",
          timeout: 5000,
        }).trim();
        if (result === "ok" && fs.existsSync(tmpFile)) {
          const buffer = fs.readFileSync(tmpFile);
          fs.unlinkSync(tmpFile);
          resolve({
            base64Data: buffer.toString("base64"),
            mimeType: "image/png",
            size: buffer.length,
          });
        } else {
          resolve(null);
        }
      } catch (_) {
        resolve(null);
      }
    } else {
      // Linux - try xclip
      try {
        const { execSync } = require("child_process");
        const tmpFile = path.join(require("os").tmpdir(), "pm_clip_img.png");
        execSync(`xclip -selection clipboard -t image/png -o > "${tmpFile}"`, {
          timeout: 5000,
        });
        if (fs.existsSync(tmpFile) && fs.statSync(tmpFile).size > 0) {
          const buffer = fs.readFileSync(tmpFile);
          fs.unlinkSync(tmpFile);
          resolve({
            base64Data: buffer.toString("base64"),
            mimeType: "image/png",
            size: buffer.length,
          });
        } else {
          resolve(null);
        }
      } catch (_) {
        resolve(null);
      }
    }
  });
}