import { getConfig } from "../config";

export interface ModelInfo {
  id: string;
  description: string;
}

export const GOOGLE_MODELS: ModelInfo[] = [
  { id: "gemini-2.0-flash", description: "Latest · fastest" },
  { id: "gemini-1.5-flash", description: "Balanced" },
  { id: "gemini-1.5-flash-8b", description: "Lightweight" },
  { id: "gemini-2.0-flash-lite", description: "Ultra light" },
];

interface GeminiContent {
  role: string;
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
}

function convertMessages(
  messages: Array<{ role: string; content: string }>
): { systemInstruction?: { parts: Array<{ text: string }> }; contents: GeminiContent[] } {
  let systemInstruction: { parts: Array<{ text: string }> } | undefined;
  const contents: GeminiContent[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemInstruction = { parts: [{ text: msg.content }] };
    } else {
      const role = msg.role === "assistant" ? "model" : "user";
      contents.push({ role, parts: [{ text: msg.content }] });
    }
  }

  return { systemInstruction, contents };
}

export async function* streamGoogleChat(
  model: string,
  messages: Array<{ role: string; content: string }>,
  images?: Array<{ base64: string; mimeType: string }>
): AsyncGenerator<string> {
  const apiKey = getConfig().apiKeys.google;
  if (!apiKey) {
    throw new Error(
      "Google API key not set. Run: pm config set google-key <key>\nGet free key at: aistudio.google.com"
    );
  }

  const { systemInstruction, contents } = convertMessages(messages);

  // Attach images to the last user message if provided
  if (images && images.length > 0 && contents.length > 0) {
    const lastContent = contents[contents.length - 1];
    if (lastContent.role === "user") {
      for (const img of images) {
        lastContent.parts.push({
          inlineData: { mimeType: img.mimeType, data: img.base64 },
        });
      }
    }
  }

  const body: Record<string, unknown> = { contents };
  if (systemInstruction) body["systemInstruction"] = systemInstruction;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    let errMsg = `Google API error ${res.status}`;
    try {
      const json = JSON.parse(text) as { error?: { message?: string } };
      if (json.error?.message) errMsg = `Google: ${json.error.message}`;
    } catch {
      errMsg = `Google API error ${res.status}: ${text.slice(0, 200)}`;
    }
    throw new Error(errMsg);
  }

  if (!res.body) throw new Error("No response body from Google");

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
              candidates?: Array<{
                content?: { parts?: Array<{ text?: string }> };
              }>;
            };
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) yield text;
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