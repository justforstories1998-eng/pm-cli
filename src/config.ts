import Conf from "conf";

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
  lastOpenRouterModel: string;
}

const defaults: AppConfig = {
  defaultProvider: "openrouter",
  defaultModel: "deepseek/deepseek-r1:free",
  ollamaUrl: "http://localhost:11434",
  apiKeys: {},
  streamOutput: true,
  theme: "dark",
  historySize: 50,
  systemPrompt: "You are a helpful AI assistant.",
  lastOpenRouterModel: "deepseek/deepseek-r1:free",
};

const store = new Conf<AppConfig>({
  projectName: "pm-cli",
  defaults,
});

export function getConfig(): AppConfig {
  return {
    defaultProvider:     store.get("defaultProvider"),
    defaultModel:        store.get("defaultModel"),
    ollamaUrl:           store.get("ollamaUrl"),
    apiKeys:             store.get("apiKeys"),
    streamOutput:        store.get("streamOutput"),
    theme:               store.get("theme"),
    historySize:         store.get("historySize"),
    systemPrompt:        store.get("systemPrompt"),
    lastOpenRouterModel: store.get("lastOpenRouterModel"),
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

// ─── OpenRouter helpers ────────────────────────────────────────────────────
export function getOpenRouterKey(): string {
  return store.get("apiKeys").openrouter || "";
}

export function setOpenRouterKey(key: string): void {
  const existing = store.get("apiKeys");
  store.set("apiKeys", { ...existing, openrouter: key });
}

export function getLastOpenRouterModel(): string {
  return store.get("lastOpenRouterModel") || "deepseek/deepseek-r1:free";
}

export function setLastOpenRouterModel(model: string): void {
  store.set("lastOpenRouterModel", model);
  store.set("defaultModel", model);
}

export function hasOpenRouterKey(): boolean {
  const key = store.get("apiKeys").openrouter;
  return !!(key && key.trim().length > 0);
}