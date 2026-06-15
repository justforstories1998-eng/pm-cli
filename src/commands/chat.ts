import readline from "readline";
import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import {
  getConfig,
  setConfig,
  hasOpenRouterKey,
  setOpenRouterKey,
  setLastOpenRouterModel,
  getLastOpenRouterModel,
} from "../config";
import { ConversationHistory } from "../utils/history";
import { SmartInput } from "../utils/input";
import {
  InteractiveMenu,
  ModelPickerMenu,
  ProviderPickerMenu,
} from "../utils/menu";
import type { Provider } from "../utils/menu";
import { streamChat, parseModelString } from "../models/index";
import {
  printCleanBanner,
  printHeader,
  printUserMessage,
  printStreamHeader,
  printStreamChunk,
  printStreamEnd,
  printError,
  printSuccess,
  printInfo,
  printWarning,
  printHelp,
  printGoodbye,
  printFileInfo,
  stripAnsi,
  C,
} from "../utils/display";

import {
  listSkills,
  uploadSkill,
  buildSkillContext,
} from "../utils/skills";
import { listModels } from "./models";
import { showConfig } from "./config";
import { copyToClipboard } from "../utils/clipboard";
import {
  processFile,
  buildMessageWithFiles,
  ProcessedFile,
  getClipboardImage,
  formatBytes,
} from "../utils/filehandler";
import {
  readFile,
  writeFile,
  appendToFile,
  deleteFile,
  listDirectory,
  searchInFiles,
  createDirectory,
  previewFile,
  findAndReplace,
  editLines,
  buildFileContext,
  formatSize,
} from "../utils/fileworker";
import {
  needsFileAccess,
  buildSmartContext,
  applyAIFixes,
  previewAIFixesTargets,
  buildAgentSystemPrompt,
  wantsFullProjectScan,
  detectSpecificFiles,
  findFileInProject,
  getAllProjectFiles,
  analyseRelevantFiles,
  parseAIEditPlan,
  printEditConfirmation,
  AgentProgressBar,
  ThinkingDisplay,
  AgentStatusDisplay,
  getWidth,
  extractCodeBlocks,
} from "../utils/agent";
import { OpenRouterModelSwitcher } from "../utils/openrouterquickswitch";
import chalk from "chalk";

export interface ChatOptions {
  provider?: string;
  model?: string;
  system?: string;
}

// ─── Ensure OpenRouter key ────────────────────────────────────────────────────
async function ensureOpenRouterKey(): Promise<boolean> {
  if (hasOpenRouterKey()) return true;
  console.log();
  printInfo("OpenRouter key not set.");
  printInfo("Get a FREE key at: openrouter.ai → Sign in → API Keys");
  console.log();
  const { key } = await inquirer.prompt([
    {
      type: "password",
      name: "key",
      message: "Paste your OpenRouter API key:",
      mask: "*",
    },
  ]);
  if (key?.trim()) {
    setOpenRouterKey(key.trim());
    printSuccess(
      "Key saved permanently! You will never need to enter it again."
    );
    console.log();
    return true;
  }
  printError(
    "No key entered.\nRun: pm config set openrouter-key sk-or-v1-xxx"
  );
  return false;
}

// ─── Main chat entry point ────────────────────────────────────────────────────
export async function startChat(
  initialMessage?: string,
  options: ChatOptions = {}
): Promise<void> {
  const cfg = getConfig();

  let currentProvider: Provider = (
    options.provider || cfg.defaultProvider
  ) as Provider;
  let currentModel = options.model || cfg.defaultModel;

  if (options.model) {
    const parsed = parseModelString(options.model, currentProvider);
    currentProvider = parsed.provider;
    currentModel = parsed.model;
  }

  if (currentProvider === "openrouter") {
    const ok = await ensureOpenRouterKey();
    if (!ok) return;
    if (!options.model) currentModel = getLastOpenRouterModel();
  }

  const systemPrompt = options.system || buildAgentSystemPrompt();
  const history = new ConversationHistory(systemPrompt, cfg.historySize);

  let lastUserMessage: string | null = null;
  let pendingFiles: ProcessedFile[] = [];
  let agentMode = true;
  const workingDir = process.cwd();

  // Per-session selected “skill” (Claude Code-style)
  let activeSkill: string | null = null;

  const progressBar = new AgentProgressBar();
  const thinkingDisplay = new ThinkingDisplay();
  const statusDisplay = new AgentStatusDisplay();

  if (initialMessage) {
    await processMessage(initialMessage);
    return;
  }

  printCleanBanner();
  printHeader(currentProvider, currentModel);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  // ─── PROCESS MESSAGE ──────────────────────────────────────────────────────
  async function processMessage(message: string): Promise<void> {
    let finalMessage = message;
    let filesRead: string[] = [];
    let isAutoRead = false;

    const msgLower = message.toLowerCase();

    const isEditRequest =
      wantsFullProjectScan(message) ||
      msgLower.includes("fix") ||
      msgLower.includes("edit") ||
      msgLower.includes("update") ||
      msgLower.includes("refactor") ||
      msgLower.includes("repair") ||
      msgLower.includes("redesign") ||
      msgLower.includes("improve") ||
      msgLower.includes("change") ||
      msgLower.includes("design") ||
      msgLower.includes("style") ||
      msgLower.includes("color") ||
      msgLower.includes("colour") ||
      msgLower.includes("theme") ||
      msgLower.includes("layout") ||
      msgLower.includes("rewrite") ||
      msgLower.includes("upgrade") ||
      msgLower.includes("enhance") ||
      msgLower.includes("modify") ||
      msgLower.includes("create") ||
      msgLower.includes("add") ||
      msgLower.includes("remove") ||
      msgLower.includes("clean") ||
      msgLower.includes("format") ||
      msgLower.includes("optimise") ||
      msgLower.includes("optimize");

    // ── Phase 1: File scanning ─────────────────────────────────────────────
    if (agentMode && needsFileAccess(message)) {
      console.log();
      statusDisplay.start();

      const stepScan = statusDisplay.addStep(
        "◈",
        "Scanning project structure"
      );
      statusDisplay.setActive(stepScan);
      await new Promise((r) => setTimeout(r, 80));

      try {
        const allFiles = getAllProjectFiles(workingDir);
        statusDisplay.setDone(stepScan, `${allFiles.length} files found`);

        const stepRead = statusDisplay.addStep(
          "⎙",
          wantsFullProjectScan(message)
            ? "Reading relevant files"
            : "Reading referenced files"
        );
        statusDisplay.setActive(stepRead);

        const stepAnalyze = statusDisplay.addStep(
          "✦",
          "Building AI context"
        );

        const { context, filesFound } = await buildSmartContext(
          message,
          workingDir,
          (_current, _total, file) => {
            statusDisplay.setActive(stepRead, file.slice(-35));
          }
        );

        statusDisplay.setDone(
          stepRead,
          `${filesFound.length} files loaded`
        );
        statusDisplay.setActive(stepAnalyze);
        await new Promise((r) => setTimeout(r, 100));

        if (filesFound.length > 0) {
          filesRead = filesFound;
          isAutoRead = true;
          statusDisplay.setDone(
            stepAnalyze,
            "Context ready — sending to AI"
          );

          // Hard cap on context size to prevent model termination
          const MAX_CONTEXT = 60000;
          const trimmedContext =
            context.length > MAX_CONTEXT
              ? context.slice(0, MAX_CONTEXT) +
                "\n\n[...context trimmed to fit model limit...]"
              : context;

          finalMessage = `${trimmedContext}\n\n---\n\nUser request: ${message}`;
        } else {
          statusDisplay.setDone(stepAnalyze, "No matching files found");
        }

        await new Promise((r) => setTimeout(r, 200));
      } catch {
        /* fail silently */
      }

      statusDisplay.stop();
    }

    lastUserMessage = message;

    // If a skill is selected for this session, prepend its context
    if (activeSkill) {
      const { context, missing } = buildSkillContext(activeSkill);
      if (missing) {
        printWarning(missing);
      } else if (context.trim()) {
        finalMessage = `=== Skill: ${activeSkill} ===
${context}

=== End Skill ===

User request: ${message}`;
      }
    }

    printUserMessage(message, pendingFiles.length > 0);

    if (pendingFiles.length > 0) {
      printFileInfo(
        pendingFiles.map((f) => ({
          name: f.name,
          type: f.type,
          size: f.size,
        }))
      );
    }

    history.addMessage("user", finalMessage);

    // ── Phase 2: AI streaming ──────────────────────────────────────────────
    // fullResponse lives outside try so it survives partial failures
    let fullResponse = "";
    let streamCompleted = false;

    try {
      printStreamHeader(currentModel);

      let firstTokenReceived = false;
      let thinkingTimeout: NodeJS.Timeout | null = null;
      let thoughtInterval: NodeJS.Timeout | null = null;

      thinkingTimeout = setTimeout(() => {
        if (!firstTokenReceived) {
          thinkingDisplay.start();
          thinkingDisplay.addThought(
            filesRead.length > 0
              ? `Analyzing ${filesRead.length} file(s)…`
              : "Processing your request…"
          );
          const thoughts = [
            "Analyzing project structure…",
            "Identifying all issues…",
            "Planning changes across files…",
            "Preparing complete file content…",
            "Almost ready…",
          ];
          let ti = 0;
          thoughtInterval = setInterval(() => {
            if (firstTokenReceived || ti >= thoughts.length) {
              if (thoughtInterval) clearInterval(thoughtInterval);
              return;
            }
            thinkingDisplay.addThought(thoughts[ti++]);
          }, 2500);
        }
      }, 800);

      let inCodeFence = false;
      // Suppress code blocks from terminal for edit requests
      const shouldSuppressCode = isEditRequest;

      const { text: fullText, images } = buildMessageWithFiles(
        finalMessage,
        pendingFiles
      );
      pendingFiles = [];

      const stream = streamChat(
        currentProvider,
        currentModel,
        history.getMessages(),
        images.length > 0 ? images : undefined
      );

      let codeBlockCount = 0;

      for await (const chunk of stream) {
        if (!firstTokenReceived) {
          firstTokenReceived = true;
          if (thinkingTimeout) {
            clearTimeout(thinkingTimeout);
            thinkingTimeout = null;
          }
          if (thoughtInterval) {
            clearInterval(thoughtInterval);
            thoughtInterval = null;
          }
          thinkingDisplay.stop();
        }

        fullResponse += chunk;

        if (shouldSuppressCode) {
          let i = 0;
          while (i < chunk.length) {
            const fenceIdx = chunk.indexOf("```", i);
            if (fenceIdx === -1) {
              if (!inCodeFence) printStreamChunk(chunk.slice(i));
              break;
            }
            if (!inCodeFence) {
              const before = chunk.slice(i, fenceIdx);
              if (before) printStreamChunk(before);
              codeBlockCount++;
              printStreamChunk(
                "\n" +
                  chalk.hex("#7F1D1D")("  ╔══ ") +
                  chalk
                    .hex("#F59E0B")
                    .bold(`CODE BLOCK #${codeBlockCount}`) +
                  chalk.hex("#7F1D1D")(" ══ ") +
                  chalk.hex("#B3B3B3")("queued for file write") +
                  chalk.hex("#7F1D1D")(" ══╗") +
                  "\n"
              );
              inCodeFence = true;
            } else {
              inCodeFence = false;
            }
            i = fenceIdx + 3;
          }
        } else {
          let i = 0;
          while (i < chunk.length) {
            const fenceIdx = chunk.indexOf("```", i);
            if (fenceIdx === -1) {
              if (!inCodeFence) printStreamChunk(chunk.slice(i));
              break;
            }
            if (!inCodeFence) {
              const before = chunk.slice(i, fenceIdx);
              if (before) printStreamChunk(before);
            }
            inCodeFence = !inCodeFence;
            i = fenceIdx + 3;
          }
        }
      }

      streamCompleted = true;

      if (thinkingTimeout) clearTimeout(thinkingTimeout);
      if (thoughtInterval) clearInterval(thoughtInterval);
      thinkingDisplay.stop();

    } catch (err) {
      thinkingDisplay.stop();

      const errMsg = err instanceof Error ? err.message : String(err);

      if (fullResponse.trim().length > 50) {
        // Got partial response — still useful
        printWarning(
          `Stream ended early (${errMsg}) — partial response received.`
        );
        printInfo(
          "Checking for code blocks in partial response…"
        );
      } else {
        printStreamEnd();
        printError(`Stream failed: ${errMsg}`);

        if (
          errMsg.includes("terminated") ||
          errMsg.includes("context") ||
          errMsg.includes("length") ||
          errMsg.includes("token") ||
          errMsg.includes("limit")
        ) {
          console.log();
          printWarning(
            "The context may be too large for this model."
          );
          printInfo("Try one of these options:");
          printInfo(
            "  1. Ask about a specific file: 'fix src/utils/display.ts'"
          );
          printInfo(
            "  2. Switch to a larger context model: /model"
          );
          printInfo(
            "  3. Be more specific: 'fix only the color variables in display.ts'"
          );
          console.log();
        }
        return;
      }
    }

    // Always show stream end
    printStreamEnd();

    // Save whatever we got to history
    if (fullResponse.trim()) {
      history.addMessage("assistant", fullResponse);
    }

    // ── Phase 3: Offer to apply fixes ─────────────────────────────────────
    // Triggers on ANY code blocks — even from partial/failed streams
    if (fullResponse.trim() && isEditRequest) {
      const codeBlocks = extractCodeBlocks(fullResponse);
      const hasRealCodeBlocks = codeBlocks.some(
        (b) => b.code.trim().length > 10
      );

      if (hasRealCodeBlocks) {
        await new Promise((r) => setTimeout(r, 400));
        await offerToApplyFixes(fullResponse, filesRead, message);
      } else if (!streamCompleted) {
        // Stream failed AND no code blocks — already showed error above
      } else {
        console.log();
        printInfo(
          "The AI responded but did not provide code blocks to apply."
        );
        printInfo(
          "Try: 'Please provide the complete updated file in a code block with the filename as the first comment line.'"
        );
      }
    }
  }

  // ─── Offer to apply AI fixes ──────────────────────────────────────────────
  async function offerToApplyFixes(
    aiResponse: string,
    originalFiles: string[],
    originalMessage: string
  ): Promise<void> {
    const { targets, newFiles } = previewAIFixesTargets(
      aiResponse,
      originalFiles,
      workingDir
    );

    const allEdits = [...targets];
    const allCreates = [...newFiles];

    // Extract summary text (non-code parts)
    const summary = aiResponse
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 400);

    printEditConfirmation(allEdits, allCreates, summary);

    // Show detected code blocks
    const codeBlocks = extractCodeBlocks(aiResponse);
    const validBlocks = codeBlocks.filter(
      (b) => b.code.trim().length > 10
    );

    if (validBlocks.length > 0) {
      console.log(
        `  ${chalk.hex("#666670")(
          `Detected ${validBlocks.length} code block(s):`
        )}`
      );
      for (const block of validBlocks) {
        const fname = block.filename
          ? chalk.hex("#F87171")(block.filename)
          : chalk.hex("#444449")("(no filename — add // filename.ts as first line)");
        const lang = chalk.hex("#444449")(`[${block.language || "text"}]`);
        console.log(`  ${chalk.hex("#F59E0B")("  ▸")} ${fname} ${lang}`);
      }
      console.log();
    }

    if (allEdits.length === 0 && allCreates.length === 0) {
      console.log(
        `  ${chalk.hex("#F59E0B")("⚠")} ${chalk.hex("#FCD34D")(
          "Could not auto-detect target filenames."
        )}`
      );
      console.log(
        `  ${chalk.hex("#666670")(
          "The AI did not include filename comments in code blocks."
        )}`
      );
      console.log(
        `  ${chalk.hex("#666670")(
          "Use [S] to view the response, or [Y] to try applying anyway."
        )}`
      );
      console.log();
    }

    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(false);
      } catch {
        /* ignore */
      }
    }

    let choice = "";
    await new Promise<void>((resolve) => {
      process.stdout.write(
        chalk.hex("#F59E0B").bold("  Your choice [Y/N/S]: ")
      );
      const tempRl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
      });
      tempRl.once("line", (line) => {
        choice = line.trim().toLowerCase();
        tempRl.close();
        resolve();
      });
    });

    console.log();

    if (choice === "s" || choice === "show") {
      const w = getWidth();
      console.log();
      console.log(
        `  ${chalk.hex("#7F1D1D")("╔")}${chalk.hex("#7F1D1D")(
          "═".repeat(w - 2)
        )}${chalk.hex("#7F1D1D")("╗")}`
      );
      console.log(
        `  ${chalk.hex("#7F1D1D")("║")} ${chalk.hex("#F59E0B")(
          "◈"
        )} ${chalk.hex("#F87171").bold("FULL AI RESPONSE")}${" ".repeat(
          Math.max(0, w - 20)
        )}${chalk.hex("#7F1D1D")("║")}`
      );
      console.log(
        `  ${chalk.hex("#7F1D1D")("╚")}${chalk.hex("#7F1D1D")(
          "═".repeat(w - 2)
        )}${chalk.hex("#7F1D1D")("╝")}`
      );
      console.log();
      console.log(chalk.hex("#E6E6E6")(aiResponse));
      console.log();

      await new Promise<void>((resolve) => {
        process.stdout.write(
          chalk.hex("#F59E0B").bold("  Apply changes? [Y/N]: ")
        );
        const tempRl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
          terminal: true,
        });
        tempRl.once("line", (line) => {
          choice = line.trim().toLowerCase();
          tempRl.close();
          resolve();
        });
      });
      console.log();
    }

    if (choice === "y" || choice === "yes") {
      if (allEdits.length === 0 && allCreates.length === 0) {
        if (originalFiles.length === 0) {
          printWarning(
            "No target files detected and no original files to fall back to."
          );
          printInfo(
            "Add the filename as the very first comment line in each code block:"
          );
          printInfo("  // src/utils/display.ts");
          console.log();
          return;
        }
        printInfo(
          `No filenames in code blocks — trying with ${originalFiles.length} original file(s)…`
        );
      }

      console.log();
      const totalFiles = Math.max(
        1,
        allEdits.length + allCreates.length || originalFiles.length
      );
      progressBar.start(totalFiles, "Preparing to write…", "writing");

      const { applied, skipped, backups } = await applyAIFixes(
        aiResponse,
        originalFiles,
        workingDir,
        (file, done, total) => {
          progressBar.update(done, `Writing: ${file}`, "writing");
        }
      );

      await new Promise((r) => setTimeout(r, 400));
      progressBar.stop();
      console.log();

      if (applied.length > 0) {
        const w = getWidth();
        console.log(
          `  ${chalk.hex("#10B981")("╔══ ✓ CHANGES APPLIED ")}${chalk.hex(
            "#10B981"
          )("═".repeat(Math.max(0, w - 24)))}${chalk.hex("#10B981")("╗")}`
        );
        for (const f of applied) {
          const padLen = Math.max(0, w - f.length - 6);
          console.log(
            `  ${chalk.hex("#10B981")("║")}  ${chalk.hex("#10B981")(
              "✓"
            )} ${chalk.hex("#E6E6E6")(f)}${" ".repeat(padLen)}${chalk.hex(
              "#10B981"
            )("║")}`
          );
        }
        console.log(
          `  ${chalk.hex("#10B981")("╚")}${chalk.hex("#10B981")(
            "═".repeat(w - 2)
          )}${chalk.hex("#10B981")("╝")}`
        );
        console.log();
      }

      if (backups.length > 0) {
        printInfo(
          `${backups.length} backup(s) created (.backup-* files)`
        );
      }

      if (skipped.length > 0) {
        console.log();
        printWarning(`Could not apply to: ${skipped.join(", ")}`);
        printInfo(
          "Add the filename as the first comment line in those code blocks."
        );
      }

      if (applied.length > 0) {
        console.log();
        printSuccess(
          `Done! ${applied.length} file(s) written. Backups saved.`
        );
      } else {
        printWarning("No files were written.");
        printInfo(
          "Use /retry and ask the AI to include filenames in code blocks."
        );
      }
    } else {
      printInfo("Changes not applied.");
      printInfo(
        "Use /retry to try again or /savereply to save the response."
      );
    }

    console.log();
  }

  // ─── SLASH COMMANDS ────────────────────────────────────────────────────────
  async function handleSlashCommand(cmd: string): Promise<"exit" | void> {
    const trimmed = cmd.slice(1).trim();
    const firstSpace = trimmed.indexOf(" ");
    const command =
      firstSpace === -1
        ? trimmed.toLowerCase()
        : trimmed.slice(0, firstSpace).toLowerCase();
    const rest =
      firstSpace === -1 ? "" : trimmed.slice(firstSpace + 1).trim();
    const args = rest.split(/\s+/).filter(Boolean);

    switch (command) {
      case "exit":
      case "quit":
      case "q":
        return "exit";

      case "help":
      case "h":
        printHelp();
        break;

      case "clear":
      case "c":
        console.clear();
        history.clear();
        printCleanBanner();
        printHeader(currentProvider, currentModel);
        break;

      case "ormodel":
      case "orm":
      case "or": {
        if (currentProvider !== "openrouter") {
          currentProvider = "openrouter";
          const ok = await ensureOpenRouterKey();
          if (!ok) {
            currentProvider = cfg.defaultProvider as Provider;
            break;
          }
        }
        if (rest) {
          currentModel = rest;
          setLastOpenRouterModel(rest);
          printSuccess(`Switched to OpenRouter model: ${rest}`);
          printHeader(currentProvider, currentModel);
        } else {
          const switcher = new OpenRouterModelSwitcher(currentModel);
          const chosen = await switcher.show();
          if (chosen) {
            currentModel = chosen;
            setLastOpenRouterModel(chosen);
            printSuccess(`Switched to: ${chosen}`);
            printHeader(currentProvider, currentModel);
          }
        }
        break;
      }

      case "model":
      case "m": {
        if (!rest) {
          printInfo(`Provider: ${currentProvider}`);
          printInfo(`Model: ${currentModel}`);
        } else if (
          rest.startsWith("openrouter:") ||
          rest.includes("/")
        ) {
          currentProvider = "openrouter";
          const ok = await ensureOpenRouterKey();
          if (!ok) break;
          currentModel = rest.replace("openrouter:", "");
          setLastOpenRouterModel(currentModel);
          printSuccess(`OpenRouter → ${currentModel}`);
          printHeader(currentProvider, currentModel);
        } else {
          const parsed = parseModelString(rest, currentProvider);
          currentProvider = parsed.provider;
          currentModel = parsed.model;
          if (currentProvider === "openrouter") {
            setLastOpenRouterModel(currentModel);
            const ok = await ensureOpenRouterKey();
            if (!ok) break;
          }
          printSuccess(
            `Switched to: ${currentProvider}:${currentModel}`
          );
          printHeader(currentProvider, currentModel);
        }
        break;
      }

      case "provider":
      case "p": {
        if (!rest) {
          printInfo(`Current provider: ${currentProvider}`);
        } else {
          currentProvider = rest as Provider;
          if (currentProvider === "openrouter") {
            const ok = await ensureOpenRouterKey();
            if (!ok) {
              currentProvider = cfg.defaultProvider as Provider;
              break;
            }
            currentModel = getLastOpenRouterModel();
          }
          printSuccess(`Provider → ${currentProvider}`);
          printHeader(currentProvider, currentModel);
        }
        break;
      }

      case "system":
        if (!rest) {
          printInfo(
            `System prompt: ${history.getSystemPrompt().slice(0, 100)}…`
          );
        } else {
          history.updateSystemPrompt(rest);
          printSuccess("System prompt updated.");
        }
        break;

      case "tokens": {
        const stats = history.getStats();
        printInfo(
          `Messages: ${stats.messageCount} · Estimated tokens: ~${stats.estimatedTokens}`
        );
        break;
      }

      case "save": {
        const filename = rest || `pm-chat-${Date.now()}.txt`;
        try {
          fs.writeFileSync(
            path.resolve(filename),
            history.toText(),
            "utf8"
          );
          printSuccess(`Saved: ${filename}`);
        } catch (err) {
          printError(
            `Save failed: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
        break;
      }

      case "models":
        await listModels();
        break;

      case "retry":
        if (lastUserMessage) {
          await processMessage(lastUserMessage);
        } else {
          printWarning("No previous message to retry.");
        }
        break;

      case "agent": {
        agentMode = !agentMode;
        printSuccess(
          `Agent mode ${
            agentMode
              ? "ON — AI will auto-read files"
              : "OFF — manual mode"
          }`
        );
        break;
      }

      case "read":
      case "cat": {
        if (!rest) {
          printError("Usage: /read <file>");
          break;
        }
        try {
          const result = readFile(rest);
          if (!result.exists) {
            const found = findFileInProject(rest, workingDir);
            if (found) {
              const r = readFile(found);
              printInfo(
                `${path.relative(workingDir, found)} — ${r.lines} lines`
              );
              console.log();
              console.log(r.content);
              console.log();
            } else {
              printError(`File not found: ${rest}`);
            }
          } else {
            printInfo(`${result.path} — ${result.lines} lines`);
            console.log();
            console.log(result.content);
            console.log();
          }
        } catch (err) {
          printError(
            err instanceof Error ? err.message : String(err)
          );
        }
        break;
      }

      case "preview": {
        if (!rest) {
          printError("Usage: /preview <file> [lines]");
          break;
        }
        const [filePath, linesStr] = rest.split(" ");
        const numLines = parseInt(linesStr || "50", 10);
        const preview = previewFile(filePath, numLines);
        console.log();
        console.log(preview);
        console.log();
        break;
      }

      case "ls":
      case "dir": {
        const dirPath = rest || ".";
        const result = listDirectory(dirPath, false);
        printInfo(`${result.path} — ${result.total} items`);
        console.log();
        for (const entry of result.entries) {
          if (entry.type === "directory") {
            console.log(C.violetDim(`  📁 ${entry.name}/`));
          } else {
            const size =
              entry.size !== undefined ? formatSize(entry.size) : "";
            console.log(
              C.white70(`  📄 ${entry.name.padEnd(40)}`) + C.dim(size)
            );
          }
        }
        console.log();
        break;
      }

      case "tree": {
        const dirPath = rest || ".";
        const result = listDirectory(dirPath, true, 4);
        printInfo(`${result.path} — ${result.total} items`);
        console.log();
        for (const entry of result.entries) {
          const depth = entry.path.split(path.sep).length - 1;
          const indent = "  ".repeat(depth + 1);
          if (entry.type === "directory") {
            console.log(C.violetDim(`${indent}📁 ${entry.name}/`));
          } else {
            console.log(C.white70(`${indent}📄 ${entry.name}`));
          }
        }
        console.log();
        break;
      }

      case "search":
      case "find": {
        if (!rest) {
          printError("Usage: /search <query> [dir]");
          break;
        }
        const parts2 = rest.split(" ");
        const query = parts2[0];
        const dirPath = parts2[1] || ".";
        printInfo(`Searching "${query}" in ${dirPath}…`);
        const results = searchInFiles(dirPath, query);
        if (results.length === 0) {
          printInfo("No results found.");
        } else {
          printSuccess(`${results.length} match(es):`);
          for (const r of results.slice(0, 30)) {
            console.log(
              C.violet(`  ${r.file}`) + C.dim(`:${r.line}`)
            );
            console.log(C.white40(`    ${r.content.slice(0, 100)}`));
          }
          if (results.length > 30) {
            printInfo(`… and ${results.length - 30} more`);
          }
        }
        console.log();
        break;
      }

      case "write":
      case "create": {
        if (!rest) {
          printError("Usage: /write <file> <content>");
          break;
        }
        const sp = rest.indexOf(" ");
        if (sp === -1) {
          printError("Usage: /write <file> <content>");
          break;
        }
        const filePath = rest.slice(0, sp);
        const content = rest.slice(sp + 1);
        const result = writeFile(filePath, content);
        printSuccess(result.message);
        break;
      }

      case "append": {
        if (!rest) {
          printError("Usage: /append <file> <content>");
          break;
        }
        const sp = rest.indexOf(" ");
        if (sp === -1) {
          printError("Usage: /append <file> <content>");
          break;
        }
        const result = appendToFile(
          rest.slice(0, sp),
          "\n" + rest.slice(sp + 1)
        );
        printSuccess(result.message);
        break;
      }

      case "delete":
      case "rm": {
        if (!rest) {
          printError("Usage: /delete <file>");
          break;
        }
        const result = deleteFile(rest);
        result.success
          ? printSuccess(result.message)
          : printError(result.message);
        break;
      }

      case "replace": {
        if (args.length < 3) {
          printError('Usage: /replace <file> "find" "replace"');
          break;
        }
        const result = findAndReplace(
          args[0],
          args[1].replace(/^"|"$/g, ""),
          args.slice(2).join(" ").replace(/^"|"$/g, "")
        );
        result.success
          ? printSuccess(result.message)
          : printError(result.message);
        break;
      }

      case "mkdir": {
        if (!rest) {
          printError("Usage: /mkdir <dir>");
          break;
        }
        const result = createDirectory(rest);
        result.success
          ? printSuccess(result.message)
          : printError(result.message);
        break;
      }

      case "savereply": {
        const filename = rest || `ai-output-${Date.now()}.txt`;
        const lastReply = history.getLastAssistantMessage();
        if (!lastReply) {
          printWarning("No AI response to save.");
          break;
        }
        writeFile(filename, lastReply, false);
        printSuccess(`Saved to: ${filename}`);
        break;
      }

      case "upload": {
        if (!rest) {
          printError("Usage: /upload <file-path>");
          break;
        }
        try {
          printInfo(`Processing: ${rest}…`);
          const processed = await processFile(rest);
          pendingFiles.push(processed);
          printSuccess(
            `Ready: ${processed.name} (${processed.type}, ${formatBytes(
              processed.size
            )})`
          );
          printInfo("Send your next message to include this file.");
        } catch (err) {
          printError(
            err instanceof Error ? err.message : String(err)
          );
        }
        break;
      }

      case "skill": {
        if (!rest) {
          printError(
            "Usage: /skill <upload|use|list>\nExamples:\n  /skill list\n  /skill upload myskill ./some-folder\n  /skill use myskill"
          );
          break;
        }

        const [sub, ...rargs] = rest.split(/\s+/).filter(Boolean);
        if (!sub) break;

        switch (sub.toLowerCase()) {
          case "list": {
            const skills = listSkills();
            if (skills.length === 0) {
              printInfo("No skills uploaded yet.");
            } else {
              printSuccess(`Skills (${skills.length}): ${skills.join(", ")}`);
            }
            break;
          }

          case "use": {
            if (rargs.length < 1) {
              printError("Usage: /skill use <name>");
              break;
            }
            const name = rargs[0];
            const { missing } = buildSkillContext(name);
            if (missing) {
              printError(missing);
              activeSkill = null;
            } else {
              activeSkill = name.replace(/[^a-zA-Z0-9_\-]/g, "_");
              printSuccess(`Skill in use for this session: ${activeSkill}`);
            }
            break;
          }

          case "upload": {
            if (rargs.length < 2) {
              printError("Usage: /skill upload <name> <path>");
              break;
            }
            const [name, ...pathParts] = rargs;
            const sourcePath = pathParts.join(" ");

            try {
              const res = await uploadSkill(name, sourcePath);
              printSuccess(
                `Skill uploaded: ${res.storedSkillName} (copied to ${res.rootDir})`
              );
            } catch (err) {
              printError(
                err instanceof Error ? err.message : String(err)
              );
            }
            break;
          }

          default:
            printError(
              `Unknown /skill command: ${sub}\nUse: /skill list | /skill use <name> | /skill upload <name> <path>`
            );
        }
        break;
      }

      case "paste-image": {
        const img = await getClipboardImage();
        if (img) {
          pendingFiles.push({
            name: `clipboard-${Date.now()}.png`,
            mimeType: img.mimeType,
            size: img.size,
            type: "image",
            base64Data: img.base64Data,
            originalPath: "",
          });
          printSuccess(
            `Image ready (${formatBytes(img.size)}). Send your message.`
          );
        } else {
          printWarning("No image in clipboard.");
        }
        break;
      }

      case "scan": {
        printInfo("Scanning project…");
        progressBar.start(1, "Scanning…", "scanning");
        const allFiles = getAllProjectFiles(workingDir);
        progressBar.stop();
        console.log();
        printSuccess(`Project has ${allFiles.length} source files`);
        const byExt: Record<string, number> = {};
        for (const f of allFiles) {
          const ext = path.extname(f) || "other";
          byExt[ext] = (byExt[ext] || 0) + 1;
        }
        for (const [ext, count] of Object.entries(byExt).sort(
          (a, b) => b[1] - a[1]
        )) {
          console.log(
            `  ${chalk.hex("#DC2626")(ext.padEnd(12))} ${chalk.hex(
              "#E6E6E6"
            )(String(count))} file(s)`
          );
        }
        console.log();
        break;
      }

      case "status": {
        const stats = history.getStats();
        const w = getWidth();
        console.log();
        console.log(
          `  ${chalk.hex("#7F1D1D")("╭─")} ${chalk.hex(
            "#F87171"
          )("◉ Session Status")} ${chalk.hex("#7F1D1D")(
            "─".repeat(Math.max(0, w - 22))
          )}${chalk.hex("#7F1D1D")("╮")}`
        );
        const row = (label: string, value: string) =>
          console.log(
            `  ${chalk.hex("#7F1D1D")("│")} ${C.white40(
              label.padEnd(16)
            )} ${C.white90(value.slice(0, w - 22))}${" ".repeat(
              Math.max(0, w - 22 - value.slice(0, w - 22).length)
            )} ${chalk.hex("#7F1D1D")("│")}`
          );
        row("Provider", currentProvider);
        row("Model", currentModel.slice(0, 40));
        row(
          "Agent Mode",
          agentMode ? "ON — auto file reading" : "OFF — manual"
        );
        row("Messages", String(stats.messageCount));
        row("Est. Tokens", `~${stats.estimatedTokens}`);
        row("Working Dir", workingDir.slice(-40));
        console.log(
          `  ${chalk.hex("#7F1D1D")("╰")}${chalk.hex("#7F1D1D")(
            "─".repeat(w - 2)
          )}${chalk.hex("#7F1D1D")("╯")}`
        );
        console.log();
        break;
      }

      case "history": {
        const messages = history.getMessages();
        const userMessages = messages.filter((m) => m.role === "user");
        console.log();
        printInfo(
          `Conversation history (${userMessages.length} exchanges):`
        );
        console.log();
        for (
          let i = 0;
          i < Math.min(userMessages.length, 10);
          i++
        ) {
          const msg = userMessages[i];
          const preview = msg.content
            .toString()
            .replace(/\n/g, " ")
            .slice(0, 70);
          console.log(
            `  ${chalk.hex("#DC2626")(
              String(i + 1).padStart(2)
            )}${C.dim(".")} ${C.white40(preview)}${
              preview.length >= 70 ? C.dim("…") : ""
            }`
          );
        }
        if (userMessages.length > 10) {
          printInfo(
            `… and ${userMessages.length - 10} more messages`
          );
        }
        console.log();
        break;
      }

      case "copy": {
        const last = history.getLastAssistantMessage();
        if (!last) {
          printWarning("No AI response to copy.");
          break;
        }
        try {
          await copyToClipboard(last);
          printSuccess("Copied to clipboard.");
        } catch (err) {
          printError(
            `Clipboard failed: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
        break;
      }

      default:
        printError(
          `Unknown command: /${command}\nType /help for all commands.`
        );
    }
  }

  // ─── MENU ACTIONS ─────────────────────────────────────────────────────────
  async function handleMenuAction(
    actionId: string
  ): Promise<"exit" | void> {
    switch (actionId) {
      case "switch-model": {
        if (currentProvider === "openrouter") {
          const switcher = new OpenRouterModelSwitcher(currentModel);
          const chosen = await switcher.show();
          if (chosen) {
            currentModel = chosen;
            setLastOpenRouterModel(chosen);
            printSuccess(`Model → ${chosen}`);
            printHeader(currentProvider, currentModel);
          }
        } else {
          const picker = new ModelPickerMenu();
          const choice = await picker.show();
          if (choice) {
            currentProvider = choice.provider;
            currentModel = choice.model;
            if (currentProvider === "openrouter") {
              setLastOpenRouterModel(currentModel);
              await ensureOpenRouterKey();
            }
            printSuccess(
              `Switched to: ${currentProvider}:${currentModel}`
            );
            printHeader(currentProvider, currentModel);
          }
        }
        break;
      }

      case "switch-provider": {
        const picker = new ProviderPickerMenu();
        const prov = await picker.show();
        if (prov) {
          currentProvider = prov;
          const defaults: Record<string, string> = {
            ollama: "llama3.2",
            groq: "llama-3.3-70b-versatile",
            openrouter: getLastOpenRouterModel(),
            google: "gemini-2.0-flash",
            kimi: "kimi-k2-preview",
            minimax: "abab6.5s-chat",
            deepseek: "deepseek-chat",
          };
          currentModel = defaults[prov] || "llama3.2";
          if (prov === "openrouter") await ensureOpenRouterKey();
          printSuccess(`Provider → ${currentProvider}`);
          printHeader(currentProvider, currentModel);
        }
        break;
      }

      case "list-models":
        await listModels();
        break;

      case "clear":
        console.clear();
        history.clear();
        printCleanBanner();
        printHeader(currentProvider, currentModel);
        break;

      case "system-prompt":
        await new Promise<void>((resolve) => {
          process.stdout.write("New system prompt: ");
          rl.question("", (answer) => {
            history.updateSystemPrompt(answer);
            printSuccess("System prompt updated.");
            resolve();
          });
        });
        break;

      case "tokens": {
        const stats = history.getStats();
        printInfo(
          `Messages: ${stats.messageCount} · Estimated tokens: ~${stats.estimatedTokens}`
        );
        break;
      }

      case "retry":
        if (lastUserMessage) await processMessage(lastUserMessage);
        else printWarning("No previous message.");
        break;

      case "save": {
        const filename = `pm-chat-${Date.now()}.txt`;
        fs.writeFileSync(
          path.resolve(filename),
          history.toText(),
          "utf8"
        );
        printSuccess(`Saved: ${filename}`);
        break;
      }

      case "copy-last": {
        const last = history.getLastAssistantMessage();
        if (!last) {
          printWarning("No AI response to copy.");
          break;
        }
        try {
          await copyToClipboard(last);
          printSuccess("Copied to clipboard.");
        } catch (err) {
          printError(
            `Clipboard failed: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
        break;
      }

      case "paste-image": {
        const img = await getClipboardImage();
        if (img) {
          pendingFiles.push({
            name: `clipboard-${Date.now()}.png`,
            mimeType: img.mimeType,
            size: img.size,
            type: "image",
            base64Data: img.base64Data,
            originalPath: "",
          });
          printSuccess("Image ready. Send your message.");
        } else {
          printWarning("No image in clipboard.");
        }
        break;
      }

      case "config":
        await showConfig();
        break;

      case "stream-toggle": {
        const current = getConfig().streamOutput;
        setConfig("streamOutput", !current);
        printSuccess(
          `Streaming ${!current ? "enabled" : "disabled"}`
        );
        break;
      }

      case "help":
        printHelp();
        break;

      case "status": {
        const stats = history.getStats();
        printInfo(
          `Provider: ${currentProvider} | Model: ${currentModel}`
        );
        printInfo(
          `Messages: ${stats.messageCount} | Tokens: ~${stats.estimatedTokens}`
        );
        printInfo(`Agent mode: ${agentMode ? "ON" : "OFF"}`);
        break;
      }

      case "exit":
        return "exit";
    }
  }

  // ─── Smart Input ──────────────────────────────────────────────────────────
  const smartInput = new SmartInput(
    rl,
    async (input: string) => {
      if (input.startsWith("/")) {
        const result = await handleSlashCommand(input);
        if (result === "exit") doExit();
      } else {
        await processMessage(input);
      }
    },
    async () => {
      const menu = new InteractiveMenu();
      const item = await menu.show();
      if (item) {
        const result = await handleMenuAction(item.id);
        if (result === "exit") doExit();
      }
    }
  );

  function doExit(): void {
    smartInput.stop();
    rl.close();
    printGoodbye();
    process.exit(0);
  }

  process.on("SIGINT", () => doExit());
  smartInput.start();
}