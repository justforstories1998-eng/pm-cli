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
  C,
} from "../utils/display";
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
} from "../utils/agent";
import { OpenRouterModelSwitcher } from "../utils/openrouterquickswitch";
import chalk from "chalk";

export interface ChatOptions {
  provider?: string;
  model?: string;
  system?: string;
}

// ─── Ensure OpenRouter key — ask ONCE, never again ────────────────────────────
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

  if (key && key.trim().length > 0) {
    setOpenRouterKey(key.trim());
    printSuccess("Key saved permanently! You will never need to enter it again.");
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

  // OpenRouter — ensure key once, restore last model
  if (currentProvider === "openrouter") {
    const ok = await ensureOpenRouterKey();
    if (!ok) return;
    if (!options.model) currentModel = getLastOpenRouterModel();
  }

  // Build system prompt with agent capabilities
  const systemPrompt = options.system || buildAgentSystemPrompt();
  const history = new ConversationHistory(systemPrompt, cfg.historySize);

  let lastUserMessage: string | null = null;
  let pendingFiles: ProcessedFile[] = [];
  let agentMode = true; // always on — AI automatically reads files when needed
  const workingDir = process.cwd();

  // ─── One-shot mode ──────────────────────────────────────────────────────
  if (initialMessage) {
    await processMessage(initialMessage);
    return;
  }

  // ─── Interactive mode ───────────────────────────────────────────────────
  printHeader(currentProvider, currentModel);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  // ─── PROCESS MESSAGE — smart routing ─────────────────────────────────────
  async function processMessage(message: string): Promise<void> {
    let finalMessage = message;
    let filesRead: string[] = [];
    let isAutoRead = false;

    // Auto-detect if files need to be read
    if (agentMode && needsFileAccess(message)) {
      try {
        const { context, filesFound, isFullScan } = await buildSmartContext(
          message,
          workingDir
        );

        if (filesFound.length > 0) {
          filesRead = filesFound;
          isAutoRead = true;

          if (isFullScan) {
            printInfo(
              `Reading ${filesFound.length} project files and analyzing…`
            );
          } else {
            printInfo(
              `Auto-reading: ${filesFound
                .map((f) => path.relative(workingDir, f))
                .join(", ")}`
            );
          }

          // Prepend file context to message
          finalMessage = `${context}\n\n---\n\nUser request: ${message}`;
        }
      } catch (err) {
        // If file reading fails just send message normally
      }
    }

    lastUserMessage = message; // store original without context

    printUserMessage(message, pendingFiles.length > 0);

    if (pendingFiles.length > 0) {
      printFileInfo(
        pendingFiles.map((f) => ({ name: f.name, type: f.type, size: f.size }))
      );
    }

    history.addMessage("user", finalMessage);

    try {
      printStreamHeader(currentModel);
      let fullResponse = "";

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

      for await (const chunk of stream) {
        printStreamChunk(chunk);
        fullResponse += chunk;
      }
      printStreamEnd();

      if (fullResponse) {
        history.addMessage("assistant", fullResponse);

        // Auto-apply fixes if files were read
        if (
          isAutoRead &&
          filesRead.length > 0 &&
          (wantsFullProjectScan(message) ||
            message.toLowerCase().includes("fix") ||
            message.toLowerCase().includes("edit") ||
            message.toLowerCase().includes("update") ||
            message.toLowerCase().includes("refactor") ||
            message.toLowerCase().includes("repair"))
        ) {
          await offerToApplyFixes(fullResponse, filesRead);
        }
      }
    } catch (err) {
      printStreamEnd();
      printError(err instanceof Error ? err.message : String(err));
    }
  }

  // ─── Offer to apply AI fixes ────────────────────────────────────────────
  async function offerToApplyFixes(
    aiResponse: string,
    originalFiles: string[]
  ): Promise<void> {
    console.log();

    const { targets, newFiles } = previewAIFixesTargets(
      aiResponse,
      originalFiles,
      workingDir
    );

    const allEdits = [...targets, ...newFiles];

    printInfo("AI has provided code fixes.");

    console.log(C.red("  ╔═ APPLY FIXES ══════════════════════════════════╗"));
    if (allEdits.length > 0) {
      console.log(
        C.red("  ║") +
          C.whiteDim("  I will edit:                                       ") +
          C.red("║")
      );
      for (const f of allEdits.slice(0, 6)) {
        console.log(
          "  " +
            C.red("  ║") +
            C.white40(`  • ${f.padEnd(46).slice(0, 46)}`) +
            C.red("  ║")
        );
      }
      if (allEdits.length > 6) {
        console.log(
          "  " +
            C.red("  ║") +
            C.whiteDim(`  • … +${allEdits.length - 6} more`) +
            C.red("  ║")
        );
      }
      console.log(C.red("  ║") + C.whiteDim("  Proceed? (Y/N)                                   ") + C.red("║"));
    } else {
      console.log(
        C.red("  ║") +
          C.whiteDim("  No file targets detected in the AI response.      ") +
          C.red("║")
      );
    }
    console.log(C.red("  ╚═════════════════════════════════════════════════╝"));
    console.log();

    // Temporarily detach raw mode for this prompt
    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(false);
      } catch (_) {}
    }

    const { apply } = await inquirer.prompt([
      {
        type: "confirm",
        name: "apply",
        message:
          allEdits.length > 0
            ? "Proceed with editing the files?"
            : "No targets detected. Continue?",
        default: true,
      },
    ]);

    if (apply && allEdits.length > 0) {
      printInfo("Applying fixes…");
      const { applied, skipped } = await applyAIFixes(
        aiResponse,
        originalFiles,
        workingDir
      );

      if (applied.length > 0) {
        printSuccess(`Fixed and saved: ${applied.join(", ")}`);
        printInfo("Backups created for all modified files.");
      }
      if (skipped.length > 0) {
        printWarning(`Could not apply to: ${skipped.join(", ")}`);
        printInfo("Copy the code manually from above.");
      }
      if (applied.length === 0 && skipped.length === 0) {
        printInfo(
          "No code blocks found to apply. Copy the code manually from above."
        );
      }
    } else {
      printInfo("Skipped applying AI fixes.");
    }

    console.log();
  }

  // ─── SLASH COMMANDS ──────────────────────────────────────────────────────
  async function handleSlashCommand(cmd: string): Promise<"exit" | void> {
    const trimmed = cmd.slice(1).trim();
    const firstSpace = trimmed.indexOf(" ");
    const command =
      firstSpace === -1
        ? trimmed.toLowerCase()
        : trimmed.slice(0, firstSpace).toLowerCase();
    const rest = firstSpace === -1 ? "" : trimmed.slice(firstSpace + 1).trim();
    const args = rest.split(/\s+/).filter(Boolean);

    switch (command) {
      // ── Exit ────────────────────────────────────────────────────────────
      case "exit":
      case "quit":
      case "q":
        return "exit";

      // ── Help ────────────────────────────────────────────────────────────
      case "help":
      case "h":
        printHelp();
        break;

      // ── Clear ───────────────────────────────────────────────────────────
      case "clear":
      case "c":
        console.clear();
        history.clear();
        printCleanBanner();
        printHeader(currentProvider, currentModel);
        break;

      // ── OpenRouter model switcher ────────────────────────────────────────
      case "ormodel":
      case "orm":
      case "or": {
        if (currentProvider !== "openrouter") {
          currentProvider = "openrouter";
          const ok = await ensureOpenRouterKey();
          if (!ok) { currentProvider = cfg.defaultProvider as Provider; break; }
        }

        // If model name provided directly — switch immediately
        if (rest) {
          const modelName = rest.includes(":free")
            ? rest
            : rest.includes("/")
            ? rest
            : rest;
          currentModel = modelName;
          setLastOpenRouterModel(modelName);
          printSuccess(`Switched to OpenRouter model: ${modelName}`);
          printHeader(currentProvider, currentModel);
        } else {
          // Open visual model switcher
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

      // ── Switch model ─────────────────────────────────────────────────────
      case "model":
      case "m": {
        if (!rest) {
          printInfo(`Provider: ${currentProvider}`);
          printInfo(`Model: ${currentModel}`);
        } else if (rest.startsWith("openrouter:") || rest.includes("/")) {
          // OpenRouter model — switch provider too
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
          printSuccess(`Switched to: ${currentProvider}:${currentModel}`);
          printHeader(currentProvider, currentModel);
        }
        break;
      }

      // ── Provider switch ──────────────────────────────────────────────────
      case "provider":
      case "p": {
        if (!rest) {
          printInfo(`Current provider: ${currentProvider}`);
        } else {
          currentProvider = rest as Provider;
          if (currentProvider === "openrouter") {
            const ok = await ensureOpenRouterKey();
            if (!ok) { currentProvider = cfg.defaultProvider as Provider; break; }
            currentModel = getLastOpenRouterModel();
          }
          printSuccess(`Provider → ${currentProvider}`);
          printHeader(currentProvider, currentModel);
        }
        break;
      }

      // ── System prompt ────────────────────────────────────────────────────
      case "system":
        if (!rest) {
          printInfo(`System prompt: ${history.getSystemPrompt().slice(0, 100)}…`);
        } else {
          history.updateSystemPrompt(rest);
          printSuccess("System prompt updated.");
        }
        break;

      // ── Tokens ──────────────────────────────────────────────────────────
      case "tokens": {
        const stats = history.getStats();
        printInfo(
          `Messages: ${stats.messageCount} · Estimated tokens: ~${stats.estimatedTokens}`
        );
        break;
      }

      // ── Save ─────────────────────────────────────────────────────────────
      case "save": {
        const filename = rest || `pm-chat-${Date.now()}.txt`;
        try {
          fs.writeFileSync(path.resolve(filename), history.toText(), "utf8");
          printSuccess(`Saved: ${filename}`);
        } catch (err) {
          printError(
            `Save failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
        break;
      }

      // ── Models list ──────────────────────────────────────────────────────
      case "models":
        await listModels();
        break;

      // ── Retry ────────────────────────────────────────────────────────────
      case "retry":
        if (lastUserMessage) {
          await processMessage(lastUserMessage);
        } else {
          printWarning("No previous message to retry.");
        }
        break;

      // ── Toggle agent mode ────────────────────────────────────────────────
      case "agent": {
        agentMode = !agentMode;
        printSuccess(
          `Agent mode ${agentMode ? "ON — AI will auto-read files" : "OFF — manual mode"}`
        );
        break;
      }

      // ── Read file (manual) ───────────────────────────────────────────────
      case "read":
      case "cat": {
        if (!rest) { printError("Usage: /read <file>"); break; }
        try {
          const result = readFile(rest);
          if (!result.exists) {
            // Try to find in project
            const found = findFileInProject(rest, workingDir);
            if (found) {
              const r = readFile(found);
              printInfo(`${path.relative(workingDir, found)} — ${r.lines} lines`);
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
          printError(err instanceof Error ? err.message : String(err));
        }
        break;
      }

      // ── Preview ───────────────────────────────────────────────────────────
      case "preview": {
        if (!rest) { printError("Usage: /preview <file> [lines]"); break; }
        const [filePath, linesStr] = rest.split(" ");
        const numLines = parseInt(linesStr || "50", 10);
        const preview = previewFile(filePath, numLines);
        console.log();
        console.log(preview);
        console.log();
        break;
      }

      // ── List dir ──────────────────────────────────────────────────────────
      case "ls":
      case "dir": {
        const dirPath = rest || ".";
        const result = listDirectory(dirPath, false);
        printInfo(`${result.path} — ${result.total} items`);
        console.log();
        for (const entry of result.entries) {
          if (entry.type === "directory") {
            console.log(C.redDim(`  📁 ${entry.name}/`));
          } else {
            const size = entry.size !== undefined ? formatSize(entry.size) : "";
            console.log(
              C.whiteDim(`  📄 ${entry.name.padEnd(40)}`) + C.gray(size)
            );
          }
        }
        console.log();
        break;
      }

      // ── Tree ─────────────────────────────────────────────────────────────
      case "tree": {
        const dirPath = rest || ".";
        const result = listDirectory(dirPath, true, 4);
        printInfo(`${result.path} — ${result.total} items`);
        console.log();
        for (const entry of result.entries) {
          const depth = entry.path.split(path.sep).length - 1;
          const indent = "  ".repeat(depth + 1);
          if (entry.type === "directory") {
            console.log(C.redDim(`${indent}📁 ${entry.name}/`));
          } else {
            console.log(C.whiteDim(`${indent}📄 ${entry.name}`));
          }
        }
        console.log();
        break;
      }

      // ── Search ────────────────────────────────────────────────────────────
      case "search":
      case "find": {
        if (!rest) { printError("Usage: /search <query> [dir]"); break; }
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
            console.log(C.redDim(`  ${r.file}`) + C.gray(`:${r.line}`));
            console.log(C.whiteDim(`    ${r.content.slice(0, 100)}`));
          }
          if (results.length > 30) printInfo(`… and ${results.length - 30} more`);
        }
        console.log();
        break;
      }

      // ── Write file ───────────────────────────────────────────────────────
      case "write":
      case "create": {
        if (!rest) { printError("Usage: /write <file> <content>"); break; }
        const sp = rest.indexOf(" ");
        if (sp === -1) { printError("Usage: /write <file> <content>"); break; }
        const filePath = rest.slice(0, sp);
        const content = rest.slice(sp + 1);
        const result = writeFile(filePath, content);
        printSuccess(result.message);
        break;
      }

      // ── Append ───────────────────────────────────────────────────────────
      case "append": {
        if (!rest) { printError("Usage: /append <file> <content>"); break; }
        const sp = rest.indexOf(" ");
        if (sp === -1) { printError("Usage: /append <file> <content>"); break; }
        const result = appendToFile(rest.slice(0, sp), "\n" + rest.slice(sp + 1));
        printSuccess(result.message);
        break;
      }

      // ── Delete ───────────────────────────────────────────────────────────
      case "delete":
      case "rm": {
        if (!rest) { printError("Usage: /delete <file>"); break; }
        const result = deleteFile(rest);
        result.success ? printSuccess(result.message) : printError(result.message);
        break;
      }

      // ── Replace ──────────────────────────────────────────────────────────
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
        result.success ? printSuccess(result.message) : printError(result.message);
        break;
      }

      // ── Mkdir ────────────────────────────────────────────────────────────
      case "mkdir": {
        if (!rest) { printError("Usage: /mkdir <dir>"); break; }
        const result = createDirectory(rest);
        result.success ? printSuccess(result.message) : printError(result.message);
        break;
      }

      // ── Save AI reply to file ─────────────────────────────────────────────
      case "savereply": {
        const filename = rest || `ai-output-${Date.now()}.txt`;
        const lastReply = history.getLastAssistantMessage();
        if (!lastReply) { printWarning("No AI response to save."); break; }
        writeFile(filename, lastReply, false);
        printSuccess(`Saved to: ${filename}`);
        break;
      }

      // ── Upload ───────────────────────────────────────────────────────────
      case "upload": {
        if (!rest) { printError("Usage: /upload <file-path>"); break; }
        try {
          printInfo(`Processing: ${rest}…`);
          const processed = await processFile(rest);
          pendingFiles.push(processed);
          printSuccess(
            `Ready: ${processed.name} (${processed.type}, ${formatBytes(processed.size)})`
          );
          printInfo("Send your next message to include this file.");
        } catch (err) {
          printError(err instanceof Error ? err.message : String(err));
        }
        break;
      }

      // ── Paste image ──────────────────────────────────────────────────────
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
          printSuccess(`Image ready (${formatBytes(img.size)}). Send your message.`);
        } else {
          printWarning("No image in clipboard.");
        }
        break;
      }

      default:
        printError(
          `Unknown command: /${command}\nType /help for all commands.`
        );
    }
  }

  // ─── MENU ACTIONS ────────────────────────────────────────────────────────
  async function handleMenuAction(actionId: string): Promise<"exit" | void> {
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
            printSuccess(`Switched to: ${currentProvider}:${currentModel}`);
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
        fs.writeFileSync(path.resolve(filename), history.toText(), "utf8");
        printSuccess(`Saved: ${filename}`);
        break;
      }

      case "copy-last": {
        const last = history.getLastAssistantMessage();
        if (!last) { printWarning("No AI response to copy."); break; }
        try {
          await copyToClipboard(last);
          printSuccess("Copied to clipboard.");
        } catch (err) {
          printError(`Clipboard failed: ${err instanceof Error ? err.message : String(err)}`);
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
          printSuccess(`Image ready. Send your message.`);
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
        printSuccess(`Streaming ${!current ? "enabled" : "disabled"}`);
        break;
      }

      case "help":
        printHelp();
        break;

      case "exit":
        return "exit";
    }
  }

  // ─── Smart Input ─────────────────────────────────────────────────────────
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