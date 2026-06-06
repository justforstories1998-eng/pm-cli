import { spawn } from "child_process";

export async function copyToClipboard(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let cmd: string;
    let args: string[];

    if (process.platform === "win32") {
      cmd = "clip";
      args = [];
    } else if (process.platform === "darwin") {
      cmd = "pbcopy";
      args = [];
    } else {
      cmd = "xclip";
      args = ["-selection", "clipboard"];
    }

    try {
      const proc = spawn(cmd, args, { stdio: ["pipe", "ignore", "ignore"] });
      proc.stdin.write(text, "utf8");
      proc.stdin.end();
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Clipboard command failed with code ${code}`));
      });
      proc.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}