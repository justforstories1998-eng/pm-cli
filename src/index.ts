#!/usr/bin/env node
import { Command } from "commander";
import { printCleanBanner } from "./utils/display";
import { startChat } from "./commands/chat";
import { listModels, pullModel, showOllamaStatus } from "./commands/models";
import { showConfig, setConfigValue, interactiveSetup } from "./commands/config";
import { getConfig, setLastOpenRouterModel, setOpenRouterKey, hasOpenRouterKey } from "./config";

const program = new Command();

program

  .name("pm")
  .description("Universal AI Terminal CLI — All Models, All Providers");

const pkg = (() => {
  try {
    // Works from both src/ (ts-node) and dist/ (compiled output)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("../package.json");
  } catch {
    return null;
  }
})();

program.version((pkg && typeof pkg.version === "string" ? pkg.version : "0.0.0"), "-v, --version");


// ─── pm [message] ─────────────────────────────────────────────────────────────
program
  .argument("[message]", "Message to send")
  .option("-p, --provider <provider>", "AI provider")
  .option("-m, --model <model>", "Model name")
  .option("-s, --system <prompt>", "System prompt")
  .action(
    async (
      message?: string,
      opts?: { provider?: string; model?: string; system?: string }
    ) => {
      await startChat(message, opts || {});
    }
  );

// ─── pm chat ──────────────────────────────────────────────────────────────────
program
  .command("chat [message]")
  .alias("c")
  .description("Start interactive chat")
  .option("-p, --provider <provider>", "AI provider")
  .option("-m, --model <model>", "Model name")
  .option("-s, --system <prompt>", "System prompt")
  .action(
    async (
      message?: string,
      opts?: { provider?: string; model?: string; system?: string }
    ) => {
      await startChat(message, opts || {});
    }
  );

// ─── pm or [model] — OpenRouter shortcut ─────────────────────────────────────
program
  .command("or [model]")
  .description("Quick OpenRouter chat — pm or deepseek/deepseek-r1:free")
  .option("-s, --system <prompt>", "System prompt")
  .action(async (model?: string, opts?: { system?: string }) => {
    const cfg = getConfig();
    const chosenModel = model || cfg.lastOpenRouterModel || "deepseek/deepseek-r1:free";
    await startChat(undefined, {
      provider: "openrouter",
      model: chosenModel,
      system: opts?.system,
    });
  });

// ─── pm groq ──────────────────────────────────────────────────────────────────
program
  .command("groq [message]")
  .description("Chat with Groq")
  .option("-m, --model <model>", "Groq model")
  .action(async (message?: string, opts?: { model?: string }) => {
    await startChat(message, { provider: "groq", model: opts?.model });
  });

// ─── pm deepseek ──────────────────────────────────────────────────────────────
program
  .command("deepseek [message]")
  .description("Chat with DeepSeek")
  .option("-m, --model <model>", "DeepSeek model")
  .action(async (message?: string, opts?: { model?: string }) => {
    await startChat(message, { provider: "deepseek", model: opts?.model || "deepseek-chat" });
  });

// ─── pm kimi ──────────────────────────────────────────────────────────────────
program
  .command("kimi [message]")
  .description("Chat with Kimi")
  .action(async (message?: string) => {
    await startChat(message, { provider: "kimi", model: "kimi-k2-preview" });
  });

// ─── pm ollama ────────────────────────────────────────────────────────────────
program
  .command("ollama [message]")
  .alias("ol")
  .description("Chat with local Ollama model")
  .option("-m, --model <model>", "Ollama model name")
  .action(async (message?: string, opts?: { model?: string }) => {
    await startChat(message, { provider: "ollama", model: opts?.model });
  });

// ─── pm models ────────────────────────────────────────────────────────────────
program
  .command("models [filter]")
  .alias("m")
  .description("List all available models")
  .action(async (filter?: string) => {
    printCleanBanner();
    await listModels(filter);
  });

// ─── pm pull ──────────────────────────────────────────────────────────────────
program
  .command("pull <model>")
  .description("Pull an Ollama model")
  .action(async (model: string) => {
    printCleanBanner();
    await pullModel(model);
  });

// ─── pm status ────────────────────────────────────────────────────────────────
program
  .command("status")
  .description("Check provider status")
  .action(async () => {
    printCleanBanner();
    await showOllamaStatus();
  });

// ─── pm config ────────────────────────────────────────────────────────────────
const configCmd = program.command("config").description("Manage configuration");

configCmd
  .command("show")
  .description("Show current config")
  .action(async () => {
    printCleanBanner();
    await showConfig();
  });

configCmd
  .command("set <key> <value>")
  .description("Set a config value")
  .action(async (key: string, value: string) => {
    await setConfigValue(key, value);
  });

configCmd
  .command("setup")
  .description("Interactive setup wizard")
  .action(async () => {
    printCleanBanner();
    await interactiveSetup();
  });

program.parseAsync(process.argv).catch((err) => {
  const { printError } = require("./utils/display");
  printError(err instanceof Error ? err.message : String(err));
  process.exit(1);
});