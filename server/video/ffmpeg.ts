import { accessSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { resolveAppDir } from "@/lib/runtimePaths";

const ffmpegBin = resolveBinary(process.env.FFMPEG_PATH, "ffmpeg");
const ffprobeBin = resolveBinary(process.env.FFPROBE_PATH, "ffprobe");

export function ffmpegPath() {
  return ffmpegBin;
}

export function ffprobePath() {
  return ffprobeBin;
}

export async function runCommand(command: string, args: string[], options?: { cwd?: string; env?: Record<string, string | undefined>; signal?: AbortSignal }) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { cwd: options?.cwd, env: options?.env ? { ...process.env, ...options.env } : process.env });
    let stdout = "";
    let stderr = "";

    const onAbort = () => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000).unref();
      reject(new Error(`Command ${command} aborted via signal.`));
    };

    if (options?.signal) {
      if (options.signal.aborted) {
        onAbort();
        return;
      }
      options.signal.addEventListener("abort", onAbort);
    }

    const cleanup = () => {
      if (options?.signal) options.signal.removeEventListener("abort", onAbort);
    };

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      cleanup();
      if (error.message.includes("ENOENT")) {
        reject(new Error(`${command} was not found. Install it and make sure it is available in PATH.`));
        return;
      }
      reject(error);
    });
    child.on("close", (code) => {
      cleanup();
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} exited with code ${code}: ${stderr || stdout}`));
    });
  });
}

export async function assertFfmpegAvailable() {
  await runCommand(ffmpegBin, ["-version"]);
  await runCommand(ffprobeBin, ["-version"]);
}

export function assPathForFilter(filePath: string) {
  return filePath.replaceAll("\\", "/").replaceAll(":", "\\:");
}

function resolveBinary(configured: string | undefined, systemName: "ffmpeg" | "ffprobe") {
  if (configured && configured !== systemName) return configured;
  // Check if a local binary exists in ./bin, otherwise rely on PATH
  const localBin = path.join(resolveAppDir(), "bin", systemName);
  try {
    accessSync(localBin);
    const probe = spawnSync(localBin, ["-version"], { stdio: "ignore" });
    if (probe.status === 0) return localBin;
    return systemName;
  } catch {
    return systemName;
  }
}
