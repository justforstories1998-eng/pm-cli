import ora from "ora";
import {
  printError,
  printInfo,
  printSuccess,
  printModelList,
  printStatus,
} from "../utils/display";
import { isOllamaRunning, pullOllamaModel } from "../models/ollama";
import { getAllModels } from "../models/index";

export async function listModels(filter?: string): Promise<void> {
  const spinner = ora({
    text: "Fetching available models…",
    color: "red",
  }).start();

  try {
    const all = await getAllModels(filter);
    spinner.stop();

    const display: Record<
      string,
      Array<{ name: string; description?: string; size?: string }>
    > = {};

    if (all.ollama.length > 0) {
      display["Ollama (local)"] = all.ollama;
    } else {
      display["Ollama (local)"] = [
        { name: "(not running or no models installed)", description: "" },
      ];
    }

    if (all.groq.length > 0) display["Groq (free cloud · fast)"] = all.groq;
    if (all.openrouter.length > 0)
      display["OpenRouter (free cloud)"] = all.openrouter;
    if (all.google.length > 0)
      display["Google Gemini (free tier)"] = all.google;
    if (all.kimi.length > 0) display["Kimi (Moonshot AI)"] = all.kimi;
    if (all.minimax.length > 0) display["MiniMax"] = all.minimax;
    if (all.deepseek.length > 0) display["DeepSeek"] = all.deepseek;

    printModelList(display);

    const ollamaRunning = await isOllamaRunning();
    if (!ollamaRunning) {
      printInfo("Ollama is not running. Start it with: ollama serve");
    } else {
      printSuccess("Ollama is running.");
    }
  } catch (err) {
    spinner.stop();
    printError(
      err instanceof Error ? err.message : "Failed to fetch models"
    );
  }
}

export async function pullModel(modelName: string): Promise<void> {
  const running = await isOllamaRunning();
  if (!running) {
    printError(
      "Ollama is not running. Start it with: ollama serve\nThen try again: pm pull " +
        modelName
    );
    return;
  }

  const spinner = ora({
    text: `Pulling ${modelName}…`,
    color: "red",
  }).start();

  try {
    await pullOllamaModel(modelName, (status, percent) => {
      if (percent !== undefined) {
        spinner.text = `Pulling ${modelName}… ${percent}% — ${status}`;
      } else {
        spinner.text = `Pulling ${modelName}… ${status}`;
      }
    });
    spinner.succeed(`Successfully pulled ${modelName}`);
  } catch (err) {
    spinner.fail(`Failed to pull ${modelName}`);
    printError(
      err instanceof Error ? err.message : "Pull failed"
    );
  }
}

export async function showOllamaStatus(): Promise<void> {
  const spinner = ora({ text: "Checking status…", color: "red" }).start();
  try {
    const running = await isOllamaRunning();
    let modelItems: Array<{ label: string; value: string; ok: boolean }> = [];

    if (running) {
      try {
        const { getOllamaModels } = await import("../models/ollama");
        const models = await getOllamaModels();
        modelItems = models.map((m) => ({
          label: m.name,
          value: m.size || "installed",
          ok: true,
        }));
      } catch {
        modelItems = [];
      }
    }

    spinner.stop();

    const statusItems: Array<{ label: string; value: string; ok: boolean }> = [
      {
        label: "Ollama Service",
        value: running ? "Running" : "Not running (ollama serve)",
        ok: running,
      },
      {
        label: "Installed Models",
        value: running ? modelItems.length.toString() : "N/A",
        ok: running,
      },
      ...modelItems,
    ];

    printStatus(statusItems);
  } catch (err) {
    spinner.stop();
    printError(
      err instanceof Error ? err.message : "Failed to check status"
    );
  }
}