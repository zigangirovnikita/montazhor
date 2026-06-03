/**
 * Quick test script for the AI edit analyzer.
 * Reads an existing transcript.json and runs the full planCuts pipeline.
 *
 * Usage: npx tsx --env-file=.env scripts/test-ai-analyzer.ts [projectId]
 */

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { isAiConfigured } from "../lib/config";
import type { CleanupMode, TranscriptJson } from "../lib/types";
import { planCuts } from "../server/pipeline/steps/planCuts";

async function main() {
  const projectId = process.argv[2] ?? "cmp399j0c0000c9pslwgto7wu";
  const cleanupMode = (process.argv[3] ?? "pauses_and_fillers") as CleanupMode;
  const transcriptPath = path.join(process.cwd(), "storage/projects", projectId, "transcript.json");
  const metadataPath = path.join(process.cwd(), "storage/projects", projectId, "metadata.json");
  const audioPath = path.join(process.cwd(), "storage/projects", projectId, "audio.wav");

  console.log("=== Montazhor Cut Planning Test ===\n");
  console.log(`Project:        ${projectId}`);
  console.log(`Cleanup mode:   ${cleanupMode}`);
  console.log(`AI configured:  ${isAiConfigured()}\n`);

  const transcript = JSON.parse(await readFile(transcriptPath, "utf8")) as TranscriptJson;
  const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as { duration: number };
  const hasAudio = await fileExists(audioPath);

  console.log(`Language: ${transcript.language}`);
  console.log(`Duration: ${metadata.duration.toFixed(2)}s`);
  console.log(`Segments: ${transcript.segments.length}`);
  console.log(`Audio post-check: ${hasAudio ? "enabled" : "disabled (audio.wav missing)"}`);
  console.log(`Text: "${transcript.segments.map((s) => s.text).join(" ")}"\n`);

  console.log("--- Running planCuts ---\n");

  const edl = await planCuts(
    transcript,
    metadata.duration,
    cleanupMode,
    (msg) => console.log(`  [LOG] ${msg}`),
    hasAudio ? audioPath : undefined
  );

  console.log(`\n✅ Result: ${edl.keptRanges.length} kept, ${edl.removedRanges.length} removed\n`);

  console.log("KEPT ranges:");
  for (const r of edl.keptRanges) {
    console.log(`  ✓ [${r.sourceStart.toFixed(2)}s – ${r.sourceEnd.toFixed(2)}s] (${(r.sourceEnd - r.sourceStart).toFixed(2)}s) ${r.reason}`);
  }

  console.log("\nREMOVED ranges:");
  for (const r of edl.removedRanges) {
    console.log(`  ✗ [${r.sourceStart.toFixed(2)}s – ${r.sourceEnd.toFixed(2)}s] (${(r.sourceEnd - r.sourceStart).toFixed(2)}s) reason=${r.reason} text="${r.text ?? ""}"`);
  }

  // Calculate total kept vs removed time
  const keptTime = edl.keptRanges.reduce((sum, r) => sum + (r.sourceEnd - r.sourceStart), 0);
  const removedTime = edl.removedRanges.reduce((sum, r) => sum + (r.sourceEnd - r.sourceStart), 0);
  console.log(`\nTotal kept:    ${keptTime.toFixed(2)}s`);
  console.log(`Total removed: ${removedTime.toFixed(2)}s`);
  console.log(`Compression:   ${((1 - keptTime / metadata.duration) * 100).toFixed(1)}%`);
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

main().catch(console.error);
