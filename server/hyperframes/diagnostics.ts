import { runCommand } from "@/server/video/ffmpeg";

function hyperframesHomeDir() {
  return `${process.cwd()}/storage/hyperframes-home`;
}

export async function diagnosePuppeteerLaunch(): Promise<string> {
  try {
    await runCommand("node", [
      "--input-type=module",
      "-e",
      "import puppeteer from 'puppeteer'; const browser = await puppeteer.launch({headless:'shell', args:['--no-sandbox','--disable-setuid-sandbox','--disable-gpu']}); await browser.close();",
    ]);
    return "Puppeteer preflight passed with --no-sandbox and disabled GPU. HyperFrames likely failed because its CLI launches Chromium with different browser flags or environment.";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Puppeteer preflight failed: ${message}`;
  }
}

export function hyperframesEnv() {
  const binDir = `${process.cwd()}/bin`;
  const homeDir = hyperframesHomeDir();
  return {
    HOME: homeDir,
    PATH: `${binDir}:${process.env.PATH ?? ""}`,
    XDG_CACHE_HOME: `${homeDir}/.cache`,
    PUPPETEER_CACHE_DIR: `${homeDir}/.cache/puppeteer`,
    PUPPETEER_DISABLE_HEADLESS_WARNING: "true",
    HYPERFRAMES_BROWSER_GPU_MODE: "software",
    HYPERFRAMES_NO_UPDATE_CHECK: "1",
  };
}
