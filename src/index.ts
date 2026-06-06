#!/usr/bin/env node
import { Command } from "commander";
import { printCleanBanner } from "./utils/display";
import { startChat } from "./commands/chat";
import { listModels, pullModel, showOllamaStatus } from "./commands/models";
import { showConfig, setConfigValue, interactiveSetup } from "./commands/config";

const pkg = {
  name: "pm-cli",
  version: "1.0.0",
  description: "Universal AI Terminal CLI — All Models, All Providers",
};

const program = new Command();

program
  .name("pm")
  .description(pkg.description)
  .version(pkg.version, "-v, --version", "Output the current version");

// ─── Default command: pm [message] ───────────────────────────────────────────
program
  .argument("[message]", "Message to send (one-shot mode if provided)")
  .option("-p, --provider <provider>", "AI provider (ollama/groq/openrouter/google/kimi/minimax/deepseek)")
  .option("-m, --model <model>", "Model name (e.g. groq:mixtral or just mixtral)")
  .option("-s, --system <prompt>", "System prompt for this session")
  .action(async (message?: string, opts?: { provider?: string; model?: string; system?: string }) => {
    printCleanBanner();
    await startChat(message, opts || {});
  });

// ─── pm chat ─────────────────────────────────────────────────────────────────
program
  .command("chat [message]")
  .alias("c")
  .description("Start interactive chat or send one-shot message")
  .option("-p, --provider <provider>", "AI provider")
  .option("-m, --model <model>", "Model name")
  .option("-s, --system <prompt>", "System prompt")
  .action(async (message?: string, opts?: { provider?: string; model?: string; system?: string }) => {
    printCleanBanner();
    await startChat(message, opts || {});
  });

// ─── pm models ───────────────────────────────────────────────────────────────
program
  .command("models [filter]")
  .alias("m")
  .description("List all available models")
  .action(async (filter?: string) => {
    printCleanBanner();
    await listModels(filter);
  });

// ─── pm pull ─────────────────────────────────────────────────────────────────
program
  .command("pull <model>")
  .description("Pull an Ollama model")
  .action(async (model: string) => {
    printCleanBanner();
    await pullModel(model);
  });

// ─── pm status ───────────────────────────────────────────────────────────────
program
  .command("status")
  .description("Check provider status and Ollama models")
  .action(async () => {
    printCleanBanner();
    await showOllamaStatus();
  });

// ─── pm config ───────────────────────────────────────────────────────────────
const configCmd = program
  .command("config")
  .description("Manage configuration");

configCmd
  .command("show")
  .description("Show current configuration")
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

// ─── Parse ────────────────────────────────────────────────────────────────────
program.parseAsync(process.argv).catch((err) => {
  const { printError } = require("./utils/display");
  printError(err instanceof Error ? err.message : String(err));
  process.exit(1);
});