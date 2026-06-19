import path from "node:path";
import { mkdir } from "node:fs/promises";
import { renderBrowserFrames } from "@/server/render/browserFrameRenderer";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.output) {
    throw new Error("Usage: tsx scripts/run-browser-frame-renderer-poc.ts --input /path/to/clean.mp4 --output /path/to/browser-rendered.mp4 [--plan /path/to/render-plan.json] [--debug]");
  }

  await mkdir(path.dirname(args.output), { recursive: true });
  const result = await renderBrowserFrames({
    cleanVideoPath: path.resolve(args.input),
    outputPath: path.resolve(args.output),
    renderPlanPath: args.plan ? path.resolve(args.plan) : undefined,
    debug: args.debug,
    log: (message) => console.log(message)
  });

  console.log(JSON.stringify(result, null, 2));
}

function parseArgs(argv: string[]) {
  const args: {
    input?: string;
    output?: string;
    plan?: string;
    debug?: boolean;
  } = {};

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--input") args.input = argv[index + 1];
    if (value === "--output") args.output = argv[index + 1];
    if (value === "--plan") args.plan = argv[index + 1];
    if (value === "--debug") args.debug = true;
  }

  return args;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
