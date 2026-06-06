import { getConfig } from "../config";
import { parseSSEStream } from "../utils/stream";

export interface ModelInfo {
  id: string;
  description: string;
}

export const KIMI_MODELS: ModelInfo[] = [
  { id: "moonshot-v1-8k", description: "Kimi 8K context" },
  { id: "moonshot-v1-32k", description: "Kimi 32K context" },
  { id: "moonshot-v1-128k", description: "Kimi 128K context" },
  { id: "kimi-k2-preview", description: "Kimi K2.6 · Latest · reasoning" },
  { id: "kimi-latest", description: "Kimi Latest" },
];

export async function* streamKimiChat(
  model: string,
  messages: Array<{ role: string; content: string }>,
  images?: Array<{ base64: string; mimeType: string }>
): AsyncGenerator<string> {
  const apiKey = getConfig().apiKeys.kimi;
  if (!apiKey) {
    throw new Error(
      "Kimi API key not set. Run: pm config set kimi-key <key>\nGet key at: platform.moonshot.cn"
    );
  }

  // If images provided, build multimodal content for last user message
  const processedMessages: Array<{
    role: string;
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  }> = messages.map((m, idx) => {
    if (
      images &&
      images.length > 0 &&
      idx === messages.length - 1 &&
      m.role === "user"
    ) {
      const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
        { type: "text", text: m.content },
      ];
      for (const img of images) {
        parts.push({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
        });
      }
      return { role: m.role, content: parts };
    }
    return { role: m.role, content: m.content };
  });

  const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: processedMessages,
      stream: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    let errMsg = `Kimi API error ${res.status}`;
    try {
      const json = JSON.parse(text) as { error?: { message?: string } };
      if (json.error?.message) errMsg = `Kimi: ${json.error.message}`;
    } catch {
      errMsg = `Kimi API error ${res.status}: ${text.slice(0, 200)}`;
    }
    throw new Error(errMsg);
  }

  if (!res.body) throw new Error("No response body from Kimi");

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