import type { EditDecisionList, EditRange } from "@/lib/types";
import { scalePadFilter, standardMp4OutputArgs } from "@/server/video/encoding";
import { ffmpegPath, runCommand } from "@/server/video/ffmpeg";
import type { VideoProfile } from "@/server/video/profile";

export function complementRanges(duration: number, removedRanges: EditRange[]): EditRange[] {
  const sorted = [...removedRanges]
    .filter((range) => range.sourceEnd > range.sourceStart)
    .sort((a, b) => a.sourceStart - b.sourceStart);
  const kept: EditRange[] = [];
  let cursor = 0;

  for (const range of sorted) {
    if (range.sourceStart > cursor) {
      kept.push({ sourceStart: cursor, sourceEnd: range.sourceStart, reason: "speech" });
    }
    cursor = Math.max(cursor, range.sourceEnd);
  }

  if (duration > cursor) {
    kept.push({ sourceStart: cursor, sourceEnd: duration, reason: "speech" });
  }

  return kept.filter((range) => range.sourceEnd - range.sourceStart > 0.5);
}

export function mergeCloseRanges(ranges: EditRange[], gap = 0.18): EditRange[] {
  const sorted = [...ranges].sort((a, b) => a.sourceStart - b.sourceStart);
  const merged: EditRange[] = [];

  for (const range of sorted) {
    const previous = merged.at(-1);
    if (!previous || range.sourceStart - previous.sourceEnd > gap) {
      merged.push({ ...range });
      continue;
    }
    previous.sourceEnd = Math.max(previous.sourceEnd, range.sourceEnd);
    previous.reason = previous.reason === range.reason ? previous.reason : "mixed";
  }

  return merged;
}

/**
 * Render a clean cut using a single FFmpeg filtergraph pass.
 *
 * Instead of encoding each segment separately and concatenating them
 * (N+1 FFmpeg invocations, N intermediate files, double re-encoding),
 * this uses trim/atrim + concat filters in one command:
 *   - One FFmpeg invocation
 *   - Zero intermediate files
 *   - Single encode pass
 *   - Output profile normalization included in the same filtergraph
 */
export async function renderCleanCut(
  inputPath: string,
  edl: EditDecisionList,
  outputPath: string,
  profile: VideoProfile
) {
  if (edl.keptRanges.length === 0) {
    throw new Error("No speech ranges remained after cut detection. Try lower aggressiveness.");
  }

  // For a single range, use simple -ss/-to (fastest path, avoids filtergraph overhead)
  if (edl.keptRanges.length === 1) {
    const range = edl.keptRanges[0];
    const args = [
      "-y",
      "-ss",
      range.sourceStart.toFixed(3),
      "-to",
      range.sourceEnd.toFixed(3),
      "-i",
      inputPath,
      "-vf",
      scalePadFilter(profile),
    ];
    args.push(...standardMp4OutputArgs(), outputPath);
    await runCommand(ffmpegPath(), args);
    return;
  }

  // Build a single filtergraph: trim each range, then concat all
  const filters: string[] = [];

  for (const [index, range] of edl.keptRanges.entries()) {
    const vLabel = `v${index}`;
    const aLabel = `a${index}`;

    filters.push(
      `[0:v]trim=start=${range.sourceStart.toFixed(3)}:end=${range.sourceEnd.toFixed(3)},setpts=PTS-STARTPTS[${vLabel}]`
    );
    filters.push(
      `[0:a]atrim=start=${range.sourceStart.toFixed(3)}:end=${range.sourceEnd.toFixed(3)},asetpts=PTS-STARTPTS[${aLabel}]`
    );
  }

  const n = edl.keptRanges.length;
  const concatInputs = edl.keptRanges.map((_, i) => `[v${i}][a${i}]`).join("");
  filters.push(`${concatInputs}concat=n=${n}:v=1:a=1[concatv][concata]`);
  filters.push(`[concatv]${scalePadFilter(profile)}[outv]`);

  const filterComplex = filters.join(";");

  await runCommand(ffmpegPath(), [
    "-y",
    "-i",
    inputPath,
    "-filter_complex",
    filterComplex,
    "-map",
    "[outv]",
    "-map",
    "[concata]",
    ...standardMp4OutputArgs(),
    outputPath
  ]);
}
