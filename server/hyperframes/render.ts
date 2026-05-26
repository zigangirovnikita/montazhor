import { rename } from "node:fs/promises";
import path from "node:path";
import { standardMp4OutputArgs } from "@/server/video/encoding";
import { ffmpegPath, runCommand } from "@/server/video/ffmpeg";
import { hyperframesEnv } from "@/server/hyperframes/diagnostics";

function renderArgs(dir: string, outputPath: string, useDocker: boolean) {
  const args = ["render", dir, "--output", outputPath, "--quality", "draft", "--workers", "1"];
  if (useDocker) args.push("--docker");
  return args;
}

function corepackArgs(dir: string, outputPath: string, useDocker: boolean) {
  return ["pnpm", "exec", "hyperframes", ...renderArgs(dir, outputPath, useDocker)];
}

export async function renderHyperframesVideo(dir: string, outputPath: string) {
  const env = hyperframesEnv();
  const localBin = path.join(process.cwd(), "node_modules", ".bin", "hyperframes");

  try {
    await runCommand(localBin, renderArgs(dir, outputPath, false), { env });
    await normalizeRenderedVideo(outputPath);
    return { mode: "local" as const };
  } catch (localBinError) {
    if (shouldRetryInDocker()) {
      try {
        await runCommand(localBin, renderArgs(dir, outputPath, true), { env });
        await normalizeRenderedVideo(outputPath);
        return { mode: "docker" as const };
      } catch (localDockerError) {
        try {
          await runCommand("corepack", corepackArgs(dir, outputPath, false), { env });
          await normalizeRenderedVideo(outputPath);
          return { mode: "corepack" as const };
        } catch (corepackError) {
          throw new Error(formatRenderFailure(localBinError, localDockerError, corepackError));
        }
      }
    }

    try {
      await runCommand("corepack", corepackArgs(dir, outputPath, false), { env });
      await normalizeRenderedVideo(outputPath);
      return { mode: "corepack" as const };
    } catch (localError) {
      throw new Error(formatRenderFailure(localBinError, undefined, localError));
    }
  }
}

function formatRenderFailure(localBinError: unknown, localDockerError: unknown, corepackError: unknown) {
  const dockerLine = localDockerError ? `\nDocker fallback failed: ${messageFor(localDockerError)}` : "";
  return `Local HyperFrames render failed: ${messageFor(localBinError)}${dockerLine}\nCorepack fallback failed: ${messageFor(corepackError)}`;
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function shouldRetryInDocker() {
  const mode = (process.env.HYPERFRAMES_RENDER_MODE ?? "auto").toLowerCase();
  if (mode === "local") return false;
  return true;
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
