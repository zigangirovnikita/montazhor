import fs from "node:fs";
import { rename } from "node:fs/promises";
import path from "node:path";
import { standardMp4OutputArgs } from "@/server/video/encoding";
import { ffmpegPath, runCommand } from "@/server/video/ffmpeg";
import { hyperframesEnv, hyperframesRenderMode } from "@/server/hyperframes/diagnostics";

type HyperframesRenderMode = "docker" | "local" | "auto";

function renderArgs(dir: string, outputPath: string, useDocker: boolean) {
  const args = ["render", dir, "--output", outputPath, "--quality", "draft", "--workers", "1"];
  if (useDocker) args.push("--docker");
  return args;
}

export async function renderHyperframesVideo(dir: string, outputPath: string) {
  const env = hyperframesEnv();
  let localBin = path.join(process.cwd(), "node_modules", ".bin", "hyperframes");
  if (!fs.existsSync(localBin)) {
    const parentBin = path.join(process.cwd(), "../../node_modules", ".bin", "hyperframes");
    if (fs.existsSync(parentBin)) {
      localBin = parentBin;
    }
  }
  const mode = hyperframesRenderMode();

  if (mode === "docker") {
    return renderWithMode(localBin, dir, outputPath, true, env, mode);
  }

  if (mode === "local") {
    return renderWithMode(localBin, dir, outputPath, false, env, mode);
  }

  try {
    return await renderWithMode(localBin, dir, outputPath, true, env, "docker");
  } catch (dockerError) {
    try {
      return await renderWithMode(localBin, dir, outputPath, false, env, "local");
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
  mode: HyperframesRenderMode
) {
  try {
    await runCommand(command, renderArgs(dir, outputPath, useDocker), { env });
    await normalizeRenderedVideo(outputPath);
    return { mode };
  } catch (error) {
    throw new Error(`HyperFrames ${mode} render failed: ${messageFor(error)}`);
  }
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatAutoRenderFailure(dockerError: unknown, localError: unknown) {
  return `HyperFrames auto render failed.\nDocker: ${messageFor(dockerError)}\nLocal: ${messageFor(localError)}`;
}

async function normalizeRenderedVideo(outputPath: string) {
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
  ]);
  await rename(normalizedPath, outputPath);
}
