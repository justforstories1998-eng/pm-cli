import { streamOllamaChat } from "./ollama";
import { streamGroqChat } from "./groq";
import { streamOpenRouterChat } from "./openrouter";
import { streamGoogleChat } from "./google";
import { streamKimiChat } from "./kimi";
import { streamMiniMaxChat } from "./minimax";
import { streamDeepSeekChat } from "./deepseek";
import { getOllamaModels } from "./ollama";
import { GROQ_MODELS } from "./groq";
import { OPENROUTER_MODELS } from "./openrouter";
import { GOOGLE_MODELS } from "./google";
import { KIMI_MODELS } from "./kimi";
import { MINIMAX_MODELS } from "./minimax";
import { DEEPSEEK_MODELS } from "./deepseek";

export type Provider =
  | "ollama"
  | "groq"
  | "openrouter"
  | "google"
  | "kimi"
  | "minimax"
  | "deepseek";

export interface ParsedModel {
  provider: Provider;
  model: string;
}

export interface ChatImages {
  base64: string;
  mimeType: string;
}

/**
 * Parse "provider:model" string. Handles OpenRouter ":free" suffix correctly.
 */
export function parseModelString(
  input: string,
  defaultProvider: Provider = "ollama"
): ParsedModel {
  // Check for provider prefix
  const providers: Provider[] = [
    "ollama",
    "groq",
    "openrouter",
    "google",
    "kimi",
    "minimax",
    "deepseek",
  ];

  for (const provider of providers) {
    if (input.startsWith(`${provider}:`)) {
      const model = input.slice(provider.length + 1);
      return { provider, model };
    }
  }

  // No provider prefix — use default
  return { provider: defaultProvider, model: input };
}

/**
 * Main streaming chat router.
 */
export async function* streamChat(
  provider: Provider,
  model: string,
  messages: Array<{ role: string; content: string }>,
  images?: ChatImages[]
): AsyncGenerator<string> {
  switch (provider) {
    case "ollama":
      yield* streamOllamaChat(model, messages);
      break;
    case "groq":
      yield* streamGroqChat(model, messages);
      break;
    case "openrouter":
      yield* streamOpenRouterChat(model, messages);
      break;
    case "google":
      yield* streamGoogleChat(model, messages, images);
      break;
    case "kimi":
      yield* streamKimiChat(model, messages, images);
      break;
    case "minimax":
      yield* streamMiniMaxChat(model, messages, images);
      break;
    case "deepseek":
      yield* streamDeepSeekChat(model, messages);
      break;
    default:
      throw new Error(`Unknown provider: ${provider as string}`);
  }
}

export interface AllModels {
  ollama: Array<{ name: string; description?: string; size?: string }>;
  groq: Array<{ name: string; description?: string }>;
  openrouter: Array<{ name: string; description?: string }>;
  google: Array<{ name: string; description?: string }>;
  kimi: Array<{ name: string; description?: string }>;
  minimax: Array<{ name: string; description?: string }>;
  deepseek: Array<{ name: string; description?: string }>;
}

export async function getAllModels(filter?: string): Promise<AllModels> {
  const f = filter?.toLowerCase();

  const filterFn = (name: string, desc?: string): boolean => {
    if (!f) return true;
    return (
      name.toLowerCase().includes(f) || (desc?.toLowerCase().includes(f) ?? false)
    );
  };

  let ollamaModels: Array<{ name: string; description?: string; size?: string }> = [];
  try {
    const raw = await getOllamaModels();
    ollamaModels = raw
      .filter((m) => filterFn(m.name))
      .map((m) => ({ name: m.name, size: m.size }));
  } catch {
    ollamaModels = [];
  }

  return {
    ollama: ollamaModels,
    groq: GROQ_MODELS.filter((m) => filterFn(m.id, m.description)).map(
      (m) => ({ name: m.id, description: m.description })
    ),
    openrouter: OPENROUTER_MODELS.filter((m) =>
      filterFn(m.id, m.description)
    ).map((m) => ({ name: m.id, description: m.description })),
    google: GOOGLE_MODELS.filter((m) => filterFn(m.id, m.description)).map(
      (m) => ({ name: m.id, description: m.description })
    ),
    kimi: KIMI_MODELS.filter((m) => filterFn(m.id, m.description)).map(
      (m) => ({ name: m.id, description: m.description })
    ),
    minimax: MINIMAX_MODELS.filter((m) => filterFn(m.id, m.description)).map(
      (m) => ({ name: m.id, description: m.description })
    ),
    deepseek: DEEPSEEK_MODELS.filter((m) =>
      filterFn(m.id, m.description)
    ).map((m) => ({ name: m.id, description: m.description })),
  };
}