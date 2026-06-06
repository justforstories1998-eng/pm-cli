import Conf from "conf";
import path from "path";

export interface ApiKeys {
  groq?: string;
  openrouter?: string;
  google?: string;
  kimi?: string;
  minimax?: string;
  deepseek?: string;
}

export interface AppConfig {
  defaultProvider: string;
  defaultModel: string;
  ollamaUrl: string;
  apiKeys: ApiKeys;
  streamOutput: boolean;
  theme: "dark" | "light";
  historySize: number;
  systemPrompt: string;
}

const defaults: AppConfig = {
  defaultProvider: "ollama",
  defaultModel: "llama3.2",
  ollamaUrl: "http://localhost:11434",
  apiKeys: {},
  streamOutput: true,
  theme: "dark",
  historySize: 20,
  systemPrompt: "You are a helpful AI assistant.",
};

const store = new Conf<AppConfig>({
  projectName: "pm-cli",
  defaults,
});

export function getConfig(): AppConfig {
  return {
    defaultProvider: store.get("defaultProvider"),
    defaultModel: store.get("defaultModel"),
    ollamaUrl: store.get("ollamaUrl"),
    apiKeys: store.get("apiKeys"),
    streamOutput: store.get("streamOutput"),
    theme: store.get("theme"),
    historySize: store.get("historySize"),
    systemPrompt: store.get("systemPrompt"),
  };
}

export function setConfig<K extends keyof AppConfig>(
  key: K,
  value: AppConfig[K]
): void {
  store.set(key, value);
}

export function getConfigPath(): string {
  return store.path;
}