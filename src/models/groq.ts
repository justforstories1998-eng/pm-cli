import { getConfig } from "../config";
import { parseSSEStream } from "../utils/stream";

export interface ModelInfo {
  id: string;
  description: string;
}

export const GROQ_MODELS: ModelInfo[] = [
  { id: "llama-3.3-70b-versatile", description: "Best overall" },
  { id: "llama-3.1-8b-instant", description: "Ultra fast" },
  { id: "mixtral-8x7b-32768", description: "Long context" },
  { id: "gemma2-9b-it", description: "Google model" },
  { id: "llama-3.2-90b-vision-preview", description: "Vision capable" },
  { id: "llama-3.2-11b-vision-preview", description: "Vision fast" },
  { id: "llama-3.2-3b-preview", description: "Compact fast" },
];

export async function* streamGroqChat(
  model: string,
  messages: Array<{ role: string; content: string }>
): AsyncGenerator<string> {
  const apiKey = getConfig().apiKeys.groq;
  if (!apiKey) {
    throw new Error(
      "Groq API key not set. Run: pm config set groq-key <key>\nGet free key at: console.groq.com"
    );
  }

  const res = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream: true }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    let errMsg = `Groq API error ${res.status}`;
    try {
      const json = JSON.parse(text) as { error?: { message?: string } };
      if (json.error?.message) errMsg = `Groq: ${json.error.message}`;
    } catch {
      errMsg = `Groq API error ${res.status}: ${text.slice(0, 200)}`;
    }
    throw new Error(errMsg);
  }

  if (!res.body) throw new Error("No response body from Groq");

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