import { getConfig } from "../config";
import { parseSSEStream } from "../utils/stream";

export interface ModelInfo {
  id: string;
  description: string;
}

export const DEEPSEEK_MODELS: ModelInfo[] = [
  { id: "deepseek-chat", description: "DeepSeek V3 · flagship chat" },
  { id: "deepseek-reasoner", description: "DeepSeek R1 · reasoning" },
  { id: "deepseek-coder", description: "DeepSeek Coder · code specialist" },
];

export async function* streamDeepSeekChat(
  model: string,
  messages: Array<{ role: string; content: string }>
): AsyncGenerator<string> {
  const apiKey = getConfig().apiKeys.deepseek;
  if (!apiKey) {
    throw new Error(
      "DeepSeek API key not set. Run: pm config set deepseek-key <key>\nGet key at: platform.deepseek.com"
    );
  }

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!res.ok) {
    const text = await res.text();
    let errMsg = `DeepSeek API error ${res.status}`;
    try {
      const json = JSON.parse(text) as { error?: { message?: string } };
      if (json.error?.message) errMsg = `DeepSeek: ${json.error.message}`;
    } catch {
      errMsg = `DeepSeek API error ${res.status}: ${text.slice(0, 200)}`;
    }
    throw new Error(errMsg);
  }

  if (!res.body) throw new Error("No response body from DeepSeek");

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