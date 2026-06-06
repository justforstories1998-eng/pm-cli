import { getConfig } from "../config";

export interface OllamaModel {
  name: string;
  size?: string;
  modified?: string;
  digest?: string;
}

function getBaseUrl(): string {
  return getConfig().ollamaUrl || "http://localhost:11434";
}

export async function isOllamaRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getOllamaModels(): Promise<OllamaModel[]> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/api/tags`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = (await res.json()) as {
    models: Array<{
      name: string;
      size?: number;
      modified_at?: string;
      digest?: string;
    }>;
  };
  return (data.models || []).map((m) => ({
    name: m.name,
    size: m.size ? formatBytes(m.size) : undefined,
    modified: m.modified_at,
    digest: m.digest,
  }));
}

export async function* streamOllamaChat(
  model: string,
  messages: Array<{ role: string; content: string }>
): AsyncGenerator<string> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama chat error ${res.status}: ${text}`);
  }

  if (!res.body) throw new Error("No response body from Ollama");

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
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line) as {
            message?: { content?: string };
            done?: boolean;
          };
          if (json.message?.content) {
            yield json.message.content;
          }
          if (json.done) return;
        } catch {
          // skip malformed
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch (_) {}
  }
}

export async function ollamaChat(
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  let result = "";
  for await (const chunk of streamOllamaChat(model, messages)) {
    result += chunk;
  }
  return result;
}

export async function pullOllamaModel(
  modelName: string,
  onProgress: (status: string, percent?: number) => void
): Promise<void> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: modelName, stream: true }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama pull error ${res.status}: ${text}`);
  }

  if (!res.body) throw new Error("No response body");

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
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line) as {
            status?: string;
            completed?: number;
            total?: number;
          };
          const percent =
            json.completed && json.total
              ? Math.round((json.completed / json.total) * 100)
              : undefined;
          onProgress(json.status || "", percent);
        } catch {
          // skip
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch (_) {}
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}