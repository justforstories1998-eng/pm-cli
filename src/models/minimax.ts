import { getConfig } from "../config";

export interface ModelInfo {
  id: string;
  description: string;
}

export const MINIMAX_MODELS: ModelInfo[] = [
  { id: "MiniMax-Text-01", description: "MiniMax Text flagship" },
  { id: "abab6.5s-chat", description: "MiniMax 2.5 balanced" },
  { id: "abab6.5g-chat", description: "MiniMax 2.5 fast" },
  { id: "abab5.5-chat", description: "MiniMax efficient" },
  { id: "MiniMax-VL-01", description: "MiniMax vision multimodal" },
];

export async function* streamMiniMaxChat(
  model: string,
  messages: Array<{ role: string; content: string }>,
  images?: Array<{ base64: string; mimeType: string }>
): AsyncGenerator<string> {
  const apiKey = getConfig().apiKeys.minimax;
  if (!apiKey) {
    throw new Error(
      "MiniMax API key not set. Run: pm config set minimax-key <key>\nGet key at: platform.minimaxi.com"
    );
  }

  // Build messages, attaching images to last user message if vision model
  const isVisionModel = model.toLowerCase().includes("vl");
  const processedMessages: Array<Record<string, unknown>> = messages.map(
    (m, idx) => {
      if (
        isVisionModel &&
        images &&
        images.length > 0 &&
        idx === messages.length - 1 &&
        m.role === "user"
      ) {
        const parts: Array<Record<string, unknown>> = [
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
    }
  );

  const res = await fetch(
    "https://api.minimaxi.chat/v1/text/chatcompletion_v2",
    {
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
    }
  );

  if (!res.ok) {
    const text = await res.text();
    let errMsg = `MiniMax API error ${res.status}`;
    try {
      const json = JSON.parse(text) as {
        base_resp?: { status_msg?: string };
      };
      if (json.base_resp?.status_msg)
        errMsg = `MiniMax: ${json.base_resp.status_msg}`;
    } catch {
      errMsg = `MiniMax API error ${res.status}: ${text.slice(0, 200)}`;
    }
    throw new Error(errMsg);
  }

  if (!res.body) throw new Error("No response body from MiniMax");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const data = trimmed.slice(6);
          if (data === "[DONE]") return;
          try {
            const json = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const content = json.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // skip
          }
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch (_) {}
  }
}