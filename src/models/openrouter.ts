import { getConfig } from "../config";

export interface ModelInfo {
  id: string;
  description: string;
}

export const OPENROUTER_MODELS: ModelInfo[] = [
  // DeepSeek
  { id: "deepseek/deepseek-r1:free",                    description: "Best reasoning · free" },
  { id: "deepseek/deepseek-chat-v3-0324:free",          description: "DeepSeek V3 · free" },
  { id: "deepseek/deepseek-r1-distill-llama-70b:free",  description: "R1 distilled 70B · free" },
  { id: "deepseek/deepseek-r1-distill-qwen-32b:free",   description: "R1 distilled 32B · free" },
  // Meta Llama
  { id: "meta-llama/llama-3.2-3b-instruct:free",        description: "Fast Meta · free" },
  { id: "meta-llama/llama-3.1-8b-instruct:free",        description: "Balanced Meta · free" },
  { id: "meta-llama/llama-3.2-1b-instruct:free",        description: "Tiny Meta · free" },
  // Google Gemma
  { id: "google/gemma-3-27b-it:free",                   description: "Gemma 3 large · free" },
  { id: "google/gemma-3-12b-it:free",                   description: "Gemma 3 medium · free" },
  { id: "google/gemma-3-4b-it:free",                    description: "Gemma 3 small · free" },
  { id: "google/gemma-2-9b-it:free",                    description: "Gemma 2 · free" },
  // Qwen
  { id: "qwen/qwen-2.5-72b-instruct:free",              description: "72B strong · free" },
  { id: "qwen/qwen-2.5-7b-instruct:free",               description: "Qwen 7B · free" },
  { id: "qwen/qwen2.5-vl-7b-instruct:free",             description: "Vision 7B · free" },
  // Microsoft
  { id: "microsoft/phi-3-mini-128k-instruct:free",      description: "128K context · free" },
  { id: "microsoft/phi-3-medium-128k-instruct:free",    description: "Phi3 medium · free" },
  // Mistral
  { id: "mistralai/mistral-7b-instruct:free",           description: "Efficient · free" },
  // Others
  { id: "nousresearch/hermes-3-llama-3.1-8b:free",      description: "Hermes 3 · free" },
  { id: "openchat/openchat-7b:free",                    description: "OpenChat · free" },
  { id: "huggingfaceh4/zephyr-7b-beta:free",            description: "Zephyr 7B · free" },
  { id: "moonshotai/kimi-k2.6:free",            description: "Kimi k2.6 · free"}
];

export async function* streamOpenRouterChat(
  model: string,
  messages: Array<{ role: string; content: string }>
): AsyncGenerator<string> {
  const apiKey = getConfig().apiKeys.openrouter;

  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "OpenRouter API key not set.\nRun: pm config set openrouter-key sk-or-v1-xxx\nGet free key at: openrouter.ai"
    );
  }

  // Clean the model name
  const cleanModel = model.trim();

  // Build request body
  const requestBody = {
    model: cleanModel,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    stream: true,
    max_tokens: 4096,
  };

  let res: Response;

  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":   "application/json",
        "Authorization":  `Bearer ${apiKey.trim()}`,
        "HTTP-Referer":   "https://github.com/pm-cli",
        "X-Title":        "PM CLI",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (networkErr) {
    throw new Error(
      `Network error connecting to OpenRouter.\nCheck your internet connection.\nDetails: ${networkErr instanceof Error ? networkErr.message : String(networkErr)}`
    );
  }

  // Handle non-200 responses with detailed errors
  if (!res.ok) {
    let errorText = "";
    let errorJson: Record<string, unknown> | null = null;

    try {
      errorText = await res.text();
      errorJson = JSON.parse(errorText) as Record<string, unknown>;
    } catch {
      // not json
    }

    // Extract meaningful error message
    let errMsg = "";

    if (errorJson) {
      const errObj = errorJson["error"] as Record<string, unknown> | undefined;
      if (errObj?.["message"]) {
        errMsg = String(errObj["message"]);
      } else if (errorJson["message"]) {
        errMsg = String(errorJson["message"]);
      }
    }

    if (!errMsg) errMsg = errorText.slice(0, 300);

    // Give helpful messages based on status code
    switch (res.status) {
      case 400:
        throw new Error(
          `OpenRouter: Bad request — model "${cleanModel}" may not exist or is invalid.\n` +
          `Try: pm -p openrouter -m "deepseek/deepseek-r1:free" "hello"\n` +
          `Details: ${errMsg}`
        );
      case 401:
        throw new Error(
          `OpenRouter: Invalid API key.\n` +
          `Run: pm config set openrouter-key sk-or-v1-xxx\n` +
          `Get key at: openrouter.ai`
        );
      case 402:
        throw new Error(
          `OpenRouter: Payment required — add credits at openrouter.ai\n` +
          `Or use a free model ending in :free\n` +
          `Details: ${errMsg}`
        );
      case 403:
        throw new Error(
          `OpenRouter: Access forbidden.\n` +
          `Your key may not have permission for model: ${cleanModel}\n` +
          `Details: ${errMsg}`
        );
      case 404:
        throw new Error(
          `OpenRouter: Model not found: "${cleanModel}"\n` +
          `Check available models at: openrouter.ai/models\n` +
          `Try: deepseek/deepseek-r1:free`
        );
      case 429:
        throw new Error(
          `OpenRouter: Rate limit reached.\n` +
          `Wait a moment and try again.\n` +
          `Details: ${errMsg}`
        );
      case 500:
      case 502:
      case 503:
        throw new Error(
          `OpenRouter server error (${res.status}).\n` +
          `Try again in a moment or switch model.\n` +
          `Details: ${errMsg}`
        );
      default:
        throw new Error(
          `OpenRouter error ${res.status}:\n${errMsg || errorText.slice(0, 200)}`
        );
    }
  }

  if (!res.body) {
    throw new Error("OpenRouter returned empty response body.");
  }

  // Parse SSE stream
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

        if (!trimmed || trimmed === ": OPENROUTER PROCESSING") continue;
        if (!trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6).trim();
        if (!data || data === "[DONE]") continue;

        try {
          const json = JSON.parse(data) as {
            choices?: Array<{
              delta?: { content?: string | null };
              finish_reason?: string;
            }>;
            error?: { message?: string };
          };

          // Check for error in stream
          if (json.error?.message) {
            throw new Error(`OpenRouter stream error: ${json.error.message}`);
          }

          const content = json.choices?.[0]?.delta?.content;
          if (content != null && content !== "") {
            yield content;
          }
        } catch (parseErr) {
          // Skip malformed JSON chunks — common with SSE streams
          if (parseErr instanceof Error && parseErr.message.startsWith("OpenRouter stream error")) {
            throw parseErr;
          }
          // Otherwise just skip the bad chunk
          continue;
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch (_) {}
  }
}