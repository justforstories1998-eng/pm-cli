import { getConfig } from "../config";
import { parseSSEStream } from "../utils/stream";

export interface ModelInfo {
  id: string;
  description: string;
}

export const OPENROUTER_MODELS: ModelInfo[] = [
  { id: "meta-llama/llama-3.2-3b-instruct:free", description: "Fast Meta" },
  { id: "meta-llama/llama-3.1-8b-instruct:free", description: "Balanced Meta" },
  { id: "google/gemma-2-9b-it:free", description: "Google model" },
  { id: "microsoft/phi-3-mini-128k-instruct:free", description: "128K context" },
  { id: "qwen/qwen-2.5-72b-instruct:free", description: "72B strong" },
  { id: "deepseek/deepseek-r1:free", description: "Best reasoning" },
  { id: "mistralai/mistral-7b-instruct:free", description: "Efficient" },
  { id: "nousresearch/hermes-3-llama-3.1-8b:free", description: "Hermes 3" },
  { id: "openchat/openchat-7b:free", description: "OpenChat 7B" },
];

export async function* streamOpenRouterChat(
  model: string,
  messages: Array<{ role: string; content: string }>
): AsyncGenerator<string> {
  const apiKey = getConfig().apiKeys.openrouter;
  if (!apiKey) {
    throw new Error(
      "OpenRouter API key not set. Run: pm config set openrouter-key <key>\nGet free key at: openrouter.ai"
    );
  }

  const res = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://github.com/pm-cli",
        "X-Title": "PM CLI",
      },
      body: JSON.stringify({ model, messages, stream: true }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    let errMsg = `OpenRouter API error ${res.status}`;
    try {
      const json = JSON.parse(text) as { error?: { message?: string } };
      if (json.error?.message) errMsg = `OpenRouter: ${json.error.message}`;
    } catch {
      errMsg = `OpenRouter API error ${res.status}: ${text.slice(0, 200)}`;
    }
    throw new Error(errMsg);
  }

  if (!res.body) throw new Error("No response body from OpenRouter");

  for await (const jsonStr of parseSSEStream(res.body)) {
    try {
      const json = JSON.parse(jsonStr) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.delta?.content;
      if (content) yield content;
    } catch {
      // skip
    }
  }
}