function hyperframesHomeDir() {
  return `${process.cwd()}/storage/hyperframes-home`;
}

export function hyperframesRenderMode(): "docker" | "local" | "auto" {
  const mode = (process.env.HYPERFRAMES_RENDER_MODE ?? "docker").toLowerCase();
  if (mode === "local" || mode === "auto" || mode === "docker") return mode;
  return "docker";
}

export function hyperframesRenderDiagnostics(): string {
  return `HyperFrames render mode: ${hyperframesRenderMode()}. Set HYPERFRAMES_RENDER_MODE=local only when Docker rendering is unavailable and the bundled Chrome path is known to be stable.`;
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
    PRODUCER_BROWSER_GPU_MODE: "software",
    PRODUCER_MAX_CONCURRENT_RENDERS: "1",
    HYPERFRAMES_NO_UPDATE_CHECK: "1",
    HYPERFRAMES_NO_TELEMETRY: "1",
  };
}
