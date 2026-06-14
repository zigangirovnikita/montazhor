import fs from "node:fs";
import { rename } from "node:fs/promises";
import path from "node:path";
import { resolveAppDir } from "@/lib/runtimePaths";
import { standardMp4OutputArgs } from "@/server/video/encoding";
import { ffmpegPath, runCommand } from "@/server/video/ffmpeg";
import { hyperframesEnv, hyperframesRenderMode } from "@/server/hyperframes/diagnostics";

type HyperframesRenderMode = "docker" | "local" | "auto";
type HyperframesRenderOptions = {
  format?: "mp4" | "webm" | "mov";
  normalize?: boolean;
  signal?: AbortSignal;
};
let browserEnsurePromise: Promise<void> | null = null;

function renderArgs(dir: string, outputPath: string, useDocker: boolean, options: HyperframesRenderOptions) {
  const args = ["render", dir, "--output", outputPath, "--quality", "draft", "--workers", "1"];
  if (options.format) args.push("--format", options.format);
  if (useDocker) args.push("--docker");
  return args;
}

export async function renderHyperframesVideo(dir: string, outputPath: string, options: HyperframesRenderOptions = {}) {
  const appDir = resolveAppDir();
  const env = hyperframesEnv();
  let localBin = path.join(appDir, "node_modules", ".bin", "hyperframes");
  if (!fs.existsSync(localBin)) {
    const parentBin = path.join(appDir, "../../node_modules", ".bin", "hyperframes");
    if (fs.existsSync(parentBin)) {
      localBin = parentBin;
    }
  }
  const mode = hyperframesRenderMode();

  if (mode === "docker") {
    try {
      return await renderWithMode(localBin, dir, outputPath, true, env, mode, appDir, options);
    } catch (dockerError) {
      if (!isDockerUnavailable(dockerError)) throw dockerError;
      return renderWithMode(localBin, dir, outputPath, false, env, "local", appDir, options);
    }
  }

  if (mode === "local") {
    return renderWithMode(localBin, dir, outputPath, false, env, mode, appDir, options);
  }

  try {
    return await renderWithMode(localBin, dir, outputPath, true, env, "docker", appDir, options);
  } catch (dockerError) {
    try {
      return await renderWithMode(localBin, dir, outputPath, false, env, "local", appDir, options);
    } catch (localError) {
      throw new Error(formatAutoRenderFailure(dockerError, localError));
    }
  }
}

async function renderWithMode(
  command: string,
  dir: string,
  outputPath: string,
  useDocker: boolean,
  env: Record<string, string | undefined>,
  mode: HyperframesRenderMode,
  appDir: string,
  options: HyperframesRenderOptions
) {
  try {
    if (!useDocker) {
      await ensureHyperframesBrowser(command, env, appDir);
    }
    await runCommand(command, renderArgs(dir, outputPath, useDocker, options), { cwd: appDir, env, signal: options.signal });
    if (options.normalize !== false) await normalizeRenderedVideo(outputPath, options.signal);
    return { mode };
  } catch (error) {
    if (!useDocker && shouldRetryAfterBrowserBootstrap(error)) {
      browserEnsurePromise = null;
      await ensureHyperframesBrowser(command, env, appDir);
      await runCommand(command, renderArgs(dir, outputPath, useDocker, options), { cwd: appDir, env, signal: options.signal });
      if (options.normalize !== false) await normalizeRenderedVideo(outputPath, options.signal);
      return { mode };
    }
    throw new Error(`HyperFrames ${mode} render failed: ${messageFor(error)}`);
  }
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatAutoRenderFailure(dockerError: unknown, localError: unknown) {
  return `HyperFrames auto render failed.\nDocker: ${messageFor(dockerError)}\nLocal: ${messageFor(localError)}`;
}

function isDockerUnavailable(error: unknown) {
  const message = messageFor(error);
  return (
    message.includes("Docker not available") ||
    message.includes("spawnSync docker ENOENT") ||
    message.includes("docker ENOENT") ||
    message.includes("Cannot connect to the Docker daemon") ||
    message.includes("Check Docker is running")
  );
}

async function ensureHyperframesBrowser(command: string, env: Record<string, string | undefined>, appDir: string) {
  if (!browserEnsurePromise) {
    browserEnsurePromise = runCommand(command, ["browser", "ensure"], { cwd: appDir, env }).then(() => undefined);
  }
  try {
    await browserEnsurePromise;
  } catch (error) {
    browserEnsurePromise = null;
    throw new Error(`HyperFrames browser bootstrap failed: ${messageFor(error)}`);
  }
}

function shouldRetryAfterBrowserBootstrap(error: unknown) {
  const message = messageFor(error);
  return (
    message.includes("Chrome not found") ||
    message.includes("chrome-headless-shell") ||
    message.includes("Permission denied") ||
    message.includes("EACCES")
  );
}

async function normalizeRenderedVideo(outputPath: string, signal?: AbortSignal) {
  const normalizedPath = `${outputPath}.normalized.mp4`;
  await runCommand(ffmpegPath(), [
    "-y",
    "-i",
    outputPath,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    ...standardMp4OutputArgs(),
    normalizedPath
  ], { signal });
  await rename(normalizedPath, outputPath);
}
