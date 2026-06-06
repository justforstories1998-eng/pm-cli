import inquirer from "inquirer";
import {
  getConfig,
  setConfig,
  getConfigPath,
  AppConfig,
  ApiKeys,
} from "../config";
import {
  printConfig,
  printError,
  printSuccess,
  printInfo,
} from "../utils/display";

export async function showConfig(): Promise<void> {
  const cfg = getConfig();
  const items = [
    { key: "provider", value: cfg.defaultProvider },
    { key: "model", value: cfg.defaultModel },
    { key: "ollama-url", value: cfg.ollamaUrl },
    { key: "stream", value: cfg.streamOutput.toString() },
    { key: "history-size", value: cfg.historySize.toString() },
    { key: "theme", value: cfg.theme },
    { key: "system-prompt", value: cfg.systemPrompt.slice(0, 40) + (cfg.systemPrompt.length > 40 ? "…" : "") },
    { key: "groq-key", value: cfg.apiKeys.groq || "", sensitive: true },
    { key: "openrouter-key", value: cfg.apiKeys.openrouter || "", sensitive: true },
    { key: "google-key", value: cfg.apiKeys.google || "", sensitive: true },
    { key: "kimi-key", value: cfg.apiKeys.kimi || "", sensitive: true },
    { key: "minimax-key", value: cfg.apiKeys.minimax || "", sensitive: true },
    { key: "deepseek-key", value: cfg.apiKeys.deepseek || "", sensitive: true },
  ];

  printConfig(items);
  printInfo(`Config file: ${getConfigPath()}`);
}

export async function setConfigValue(key: string, value: string): Promise<void> {
  const cfg = getConfig();

  switch (key) {
    case "provider":
      setConfig("defaultProvider", value);
      printSuccess(`Provider set to: ${value}`);
      break;
    case "model":
      setConfig("defaultModel", value);
      printSuccess(`Model set to: ${value}`);
      break;
    case "ollama-url":
      setConfig("ollamaUrl", value);
      printSuccess(`Ollama URL set to: ${value}`);
      break;
    case "groq-key":
      setConfig("apiKeys", { ...cfg.apiKeys, groq: value });
      printSuccess("Groq API key saved.");
      break;
    case "openrouter-key":
      setConfig("apiKeys", { ...cfg.apiKeys, openrouter: value });
      printSuccess("OpenRouter API key saved.");
      break;
    case "google-key":
      setConfig("apiKeys", { ...cfg.apiKeys, google: value });
      printSuccess("Google API key saved.");
      break;
    case "kimi-key":
      setConfig("apiKeys", { ...cfg.apiKeys, kimi: value });
      printSuccess("Kimi API key saved.");
      break;
    case "minimax-key":
      setConfig("apiKeys", { ...cfg.apiKeys, minimax: value });
      printSuccess("MiniMax API key saved.");
      break;
    case "deepseek-key":
      setConfig("apiKeys", { ...cfg.apiKeys, deepseek: value });
      printSuccess("DeepSeek API key saved.");
      break;
    case "stream":
      setConfig("streamOutput", value === "true" || value === "on");
      printSuccess(`Streaming set to: ${value === "true" || value === "on"}`);
      break;
    case "system":
      setConfig("systemPrompt", value);
      printSuccess("System prompt updated.");
      break;
    case "history-size": {
      const n = parseInt(value, 10);
      if (isNaN(n) || n < 1) {
        printError("history-size must be a positive integer");
        return;
      }
      setConfig("historySize", n);
      printSuccess(`History size set to: ${n}`);
      break;
    }
    default:
      printError(
        `Unknown config key: "${key}"\n\nValid keys: provider, model, ollama-url, groq-key, openrouter-key, google-key, kimi-key, minimax-key, deepseek-key, stream, system, history-size`
      );
  }
}

export async function interactiveSetup(): Promise<void> {
  console.log();
  printInfo("Welcome to PM CLI Setup Wizard\n");

  const { provider } = await inquirer.prompt([
    {
      type: "list",
      name: "provider",
      message: "Default AI provider:",
      choices: [
        { name: "Ollama (local, always free)", value: "ollama" },
        { name: "Groq (fastest free cloud)", value: "groq" },
        { name: "OpenRouter (most free models)", value: "openrouter" },
        { name: "Google Gemini (free tier)", value: "google" },
        { name: "Kimi / Moonshot AI", value: "kimi" },
        { name: "MiniMax", value: "minimax" },
        { name: "DeepSeek", value: "deepseek" },
      ],
      default: "ollama",
    },
  ]);

  const defaultModelMap: Record<string, string> = {
    ollama: "llama3.2",
    groq: "llama-3.3-70b-versatile",
    openrouter: "meta-llama/llama-3.1-8b-instruct:free",
    google: "gemini-2.0-flash",
    kimi: "kimi-k2-preview",
    minimax: "abab6.5s-chat",
    deepseek: "deepseek-chat",
  };

  const { model } = await inquirer.prompt([
    {
      type: "input",
      name: "model",
      message: "Default model:",
      default: defaultModelMap[provider as string] || "llama3.2",
    },
  ]);

  const apiKeyPrompts: Record<
    string,
    { message: string; key: keyof ApiKeys; hint: string }
  > = {
    groq: {
      message: "Groq API key (get free at console.groq.com):",
      key: "groq",
      hint: "console.groq.com",
    },
    openrouter: {
      message: "OpenRouter API key (get free at openrouter.ai):",
      key: "openrouter",
      hint: "openrouter.ai",
    },
    google: {
      message: "Google API key (get free at aistudio.google.com):",
      key: "google",
      hint: "aistudio.google.com",
    },
    kimi: {
      message: "Kimi API key (get at platform.moonshot.cn):",
      key: "kimi",
      hint: "platform.moonshot.cn",
    },
    minimax: {
      message: "MiniMax API key (get at platform.minimaxi.com):",
      key: "minimax",
      hint: "platform.minimaxi.com",
    },
    deepseek: {
      message: "DeepSeek API key (get at platform.deepseek.com):",
      key: "deepseek",
      hint: "platform.deepseek.com",
    },
  };

  const cfg = getConfig();
  let newApiKeys: ApiKeys = { ...cfg.apiKeys };

  if (provider !== "ollama" && apiKeyPrompts[provider as string]) {
    const promptInfo = apiKeyPrompts[provider as string];
    const { apiKey } = await inquirer.prompt([
      {
        type: "password",
        name: "apiKey",
        message: promptInfo.message,
        mask: "*",
      },
    ]);
    if (apiKey) {
      newApiKeys[promptInfo.key] = apiKey as string;
    }
  }

  let ollamaUrl = cfg.ollamaUrl;
  if (provider === "ollama") {
    const { url } = await inquirer.prompt([
      {
        type: "input",
        name: "url",
        message: "Ollama base URL:",
        default: cfg.ollamaUrl,
      },
    ]);
    ollamaUrl = url as string;
    setConfig("ollamaUrl", ollamaUrl);
  }

  const { systemPrompt } = await inquirer.prompt([
    {
      type: "input",
      name: "systemPrompt",
      message: "System prompt:",
      default: cfg.systemPrompt,
    },
  ]);

  setConfig("defaultProvider", provider as string);
  setConfig("defaultModel", model as string);
  setConfig("apiKeys", newApiKeys);
  setConfig("systemPrompt", systemPrompt as string);

  console.log();
  printSuccess("Configuration saved!");
  printSuccess(`Run: pm chat — to start chatting`);
  printSuccess(`Run: pm "Hello world" — for one-shot mode`);
  console.log();
}