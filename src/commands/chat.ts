import readline from "readline";
import fs from "fs";
import path from "path";
import { getConfig, setConfig } from "../config";
import { ConversationHistory } from "../utils/history";
import { SmartInput } from "../utils/input";
import { InteractiveMenu, ModelPickerMenu, ProviderPickerMenu } from "../utils/menu";
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
  printModelList,
  printGoodbye,
  printFileInfo,
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
import { getAllModels } from "../models/index";

export interface ChatOptions {
  provider?: string;
  model?: string;
  system?: string;
}

export async function startChat(
  initialMessage?: string,
  options: ChatOptions = {}
): Promise<void> {
  const cfg = getConfig();

  let currentProvider: Provider = (
    options.provider || cfg.defaultProvider
  ) as Provider;
  let currentModel = options.model || cfg.defaultModel;

  // Parse provider:model from options.model
  if (options.model) {
    const parsed = parseModelString(options.model, currentProvider);
    currentProvider = parsed.provider;
    currentModel = parsed.model;
  }

  const systemPrompt = options.system || cfg.systemPrompt;
  const history = new ConversationHistory(systemPrompt, cfg.historySize);

  let lastUserMessage: string | null = null;
  let pendingFiles: ProcessedFile[] = [];

  // ─── One-shot mode ──────────────────────────────────────────────────────────
  if (initialMessage) {
    await sendMessage(initialMessage, [], currentProvider, currentModel, history);
    return;
  }

  // ─── Interactive mode ────────────────────────────────────────────────────────
  printHeader(currentProvider, currentModel);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  let running = true;

  async function sendMessage(
    text: string,
    files: ProcessedFile[],
    provider: Provider,
    model: string,
    hist: ConversationHistory
  ): Promise<void> {
    const { text: fullText, images } = buildMessageWithFiles(text, files);
    lastUserMessage = fullText;

    printUserMessage(text, files.length > 0);

    if (files.length > 0) {
      printFileInfo(
        files.map((f) => ({ name: f.name, type: f.type, size: f.size }))
      );
    }

    hist.addMessage("user", fullText);

    try {
      printStreamHeader(model);
      let fullResponse = "";
      const stream = streamChat(provider, model, hist.getMessages(), images.length > 0 ? images : undefined);

      for await (const chunk of stream) {
        printStreamChunk(chunk);
        fullResponse += chunk;
      }
      printStreamEnd();

      if (fullResponse) {
        hist.addMessage("assistant", fullResponse);
      }
    } catch (err) {
      printStreamEnd();
      const msg = err instanceof Error ? err.message : String(err);
      printError(msg);
    }
  }

  async function handleSlashCommand(cmd: string): Promise<"exit" | void> {
    const parts = cmd.slice(1).trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

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

      case "model":
        if (args.length === 0) {
          printInfo(`Current model: ${currentProvider}:${currentModel}`);
        } else {
          const parsed = parseModelString(args.join(" "), currentProvider);
          currentProvider = parsed.provider;
          currentModel = parsed.model;
          printSuccess(`Switched to: ${currentProvider}:${currentModel}`);
          printHeader(currentProvider, currentModel);
        }
        break;

      case "system":
        if (args.length === 0) {
          printInfo(`Current system prompt: ${history.getSystemPrompt()}`);
        } else {
          const newPrompt = args.join(" ");
          history.updateSystemPrompt(newPrompt);
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
        const filename = args[0] || `pm-chat-${Date.now()}.txt`;
        try {
          fs.writeFileSync(path.resolve(filename), history.toText(), "utf8");
          printSuccess(`Conversation saved to: ${filename}`);
        } catch (err) {
          printError(
            `Could not save file: ${err instanceof Error ? err.message : String(err)}`
          );
        }
        break;
      }

      case "models":
        await listModels();
        break;

      case "retry":
        if (lastUserMessage) {
          await sendMessage(lastUserMessage, [], currentProvider, currentModel, history);
        } else {
          printWarning("No previous message to retry.");
        }
        break;

      case "upload": {
        const filePath = args.join(" ");
        if (!filePath) {
          printError("Usage: /upload <file-path>");
          break;
        }
        try {
          printInfo(`Processing file: ${filePath}…`);
          const processed = await processFile(filePath);
          pendingFiles.push(processed);
          printSuccess(
            `File ready: ${processed.name} (${processed.type}, ${formatBytes(processed.size)}). Send your next message to include it.`
          );
        } catch (err) {
          printError(
            `Failed to process file: ${err instanceof Error ? err.message : String(err)}`
          );
        }
        break;
      }

      case "paste-image": {
        printInfo("Checking clipboard for image…");
        try {
          const img = await getClipboardImage();
          if (img) {
            // Convert to ProcessedFile shape
            pendingFiles.push({
              name: `clipboard-image-${Date.now()}.png`,
              mimeType: img.mimeType,
              size: img.size,
              type: "image",
              base64Data: img.base64Data,
              originalPath: "",
            });
            printSuccess(
              `Clipboard image ready (${formatBytes(img.size)}). Send your next message to include it.`
            );
          } else {
            printWarning("No image found in clipboard.");
          }
        } catch (err) {
          printError(
            `Failed to read clipboard: ${err instanceof Error ? err.message : String(err)}`
          );
        }
        break;
      }

      default:
        printError(
          `Unknown command: /${command}\nType /help to see all commands, or type / + Enter for the interactive menu.`
        );
    }
  }

  async function handleMenuAction(actionId: string): Promise<"exit" | void> {
    switch (actionId) {
      case "switch-model": {
        const picker = new ModelPickerMenu();
        const choice = await picker.show();
        if (choice) {
          currentProvider = choice.provider;
          currentModel = choice.model;
          printSuccess(
            `Switched to: ${currentProvider}:${currentModel}`
          );
          printHeader(currentProvider, currentModel);
        }
        break;
      }

      case "switch-provider": {
        const picker = new ProviderPickerMenu();
        const prov = await picker.show();
        if (prov) {
          currentProvider = prov;
          const defaultModels: Record<string, string> = {
            ollama: "llama3.2",
            groq: "llama-3.3-70b-versatile",
            openrouter: "meta-llama/llama-3.1-8b-instruct:free",
            google: "gemini-2.0-flash",
            kimi: "kimi-k2-preview",
            minimax: "abab6.5s-chat",
            deepseek: "deepseek-chat",
          };
          currentModel = defaultModels[prov] || "llama3.2";
          printSuccess(`Switched to provider: ${currentProvider}`);
          printHeader(currentProvider, currentModel);
        }
        break;
      }

      case "list-models":
        await listModels();
        break;

      case "pull-model":
        printInfo(
          "Use the slash command: /upload <model-name>\nOr run: pm pull <model-name>"
        );
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
        if (lastUserMessage) {
          await sendMessage(lastUserMessage, [], currentProvider, currentModel, history);
        } else {
          printWarning("No previous message to retry.");
        }
        break;

      case "save": {
        const filename = `pm-chat-${Date.now()}.txt`;
        try {
          fs.writeFileSync(path.resolve(filename), history.toText(), "utf8");
          printSuccess(`Conversation saved to: ${filename}`);
        } catch (err) {
          printError(
            `Save failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
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
          printSuccess("Last response copied to clipboard.");
        } catch (err) {
          printError(
            `Clipboard failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
        break;
      }

      case "paste-image": {
        printInfo("Checking clipboard for image…");
        try {
          const img = await getClipboardImage();
          if (img) {
            pendingFiles.push({
              name: `clipboard-image-${Date.now()}.png`,
              mimeType: img.mimeType,
              size: img.size,
              type: "image",
              base64Data: img.base64Data,
              originalPath: "",
            });
            printSuccess(
              `Clipboard image ready (${formatBytes(img.size)}). Send your next message to include it.`
            );
          } else {
            printWarning("No image found in clipboard.");
          }
        } catch (err) {
          printError(
            `Failed to read clipboard: ${err instanceof Error ? err.message : String(err)}`
          );
        }
        break;
      }

      case "upload-file":
        printInfo("Use the slash command: /upload <file-path>");
        printInfo("Supports: images, PDF, DOCX, XLSX, ZIP, code files, and more");
        break;

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

      default:
        printInfo(`Action: ${actionId}`);
    }
  }

  const smartInput = new SmartInput(
    rl,
    async (input: string) => {
      if (input.startsWith("/")) {
        const result = await handleSlashCommand(input);
        if (result === "exit") {
          doExit();
        }
      } else {
        const filesToSend = [...pendingFiles];
        pendingFiles = [];
        await sendMessage(input, filesToSend, currentProvider, currentModel, history);
      }
    },
    async () => {
      const menu = new InteractiveMenu();
      const item = await menu.show();
      if (item) {
        const result = await handleMenuAction(item.id);
        if (result === "exit") {
          doExit();
        }
      }
    }
  );

  function doExit(): void {
    running = false;
    smartInput.stop();
    rl.close();
    printGoodbye();
    process.exit(0);
  }

  process.on("SIGINT", () => {
    doExit();
  });

  smartInput.start();
}

// Re-export sendMessage for one-shot use
async function sendMessage(
  text: string,
  files: ProcessedFile[],
  provider: Provider,
  model: string,
  history: ConversationHistory
): Promise<void> {
  const { text: fullText, images } = buildMessageWithFiles(text, files);
  history.addMessage("user", fullText);

  try {
    printStreamHeader(model);
    let fullResponse = "";
    const stream = streamChat(
      provider,
      model,
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
    }
  } catch (err) {
    printStreamEnd();
    const msg = err instanceof Error ? err.message : String(err);
    printError(msg);
  }
}