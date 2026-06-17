import type { CompiledScenePlan } from "@/lib/types";

export interface SceneCoverageOptions {
  maxGapSeconds?: number;
  countSubtitlesAsCoverage?: boolean;
}

export type SceneCoverageReport = {
  ok: boolean;
  maxGapSeconds: number;
  blocks: Array<{
    blockId: string;
    sceneId: string;
    recipeId: string;
    renderPath: string;
    start: number;
    end: number;
    ranges: Array<{
      type: string;
      start: number;
      end: number;
    }>;
    gaps: Array<{
      start: number;
      end: number;
      duration: number;
    }>;
    warnings: string[];
  }>;
  warnings: string[];
};

export function validateCompiledSceneCoverage(
  compiledScenePlan: CompiledScenePlan,
  options?: SceneCoverageOptions
): SceneCoverageReport {
  const maxGapSeconds = options?.maxGapSeconds ?? 0.8;
  const _countSubtitlesAsCoverage = options?.countSubtitlesAsCoverage ?? false;

  const report: SceneCoverageReport = {
    ok: true,
    maxGapSeconds,
    blocks: [],
    warnings: []
  };

  for (const block of compiledScenePlan.blocks) {
    const blockWarnings: string[] = [];
    const ranges: Array<{ type: string; start: number; end: number }> = [];

    if (block.fullScene) {
      ranges.push({
        type: "fullScene",
        start: block.fullScene.start,
        end: block.fullScene.start + block.fullScene.duration
      });
    }

    if (block.overlayBeats) {
      for (const overlay of block.overlayBeats) {
        const overlayEnd = overlay.start + overlay.duration;
        
        if (overlay.duration <= 0) {
          blockWarnings.push(`Overlay beat ${overlay.id} has duration <= 0`);
        }
        
        // Use a small epsilon (e.g. 0.001) for floating point comparison if needed, 
        // but strict inequality is fine per instructions.
        if (overlay.start < block.start - 0.001 || overlayEnd > block.end + 0.001) {
          blockWarnings.push(`Overlay beat ${overlay.id} exceeds block boundaries`);
        }

        ranges.push({
          type: "overlay",
          start: overlay.start,
          end: overlayEnd
        });
      }
    }

    // Sort ranges by start time
    ranges.sort((a, b) => a.start - b.start);

    // Merge overlapping ranges for gap calculation
    const mergedRanges: Array<{ start: number; end: number }> = [];
    for (const r of ranges) {
      if (mergedRanges.length === 0) {
        mergedRanges.push({ start: r.start, end: r.end });
      } else {
        const last = mergedRanges[mergedRanges.length - 1]!;
        if (r.start <= last.end + 0.001) { // Overlapping or adjacent
          last.end = Math.max(last.end, r.end);
        } else {
          mergedRanges.push({ start: r.start, end: r.end });
        }
      }
    }

    const gaps: Array<{ start: number; end: number; duration: number }> = [];

    if (mergedRanges.length === 0) {
      const duration = block.end - block.start;
      if (duration > maxGapSeconds) {
        gaps.push({ start: block.start, end: block.end, duration });
        blockWarnings.push(`Block has no visual coverage and creates a ${duration.toFixed(3)}s gap`);
      }
    } else {
      // Check gap before first range
      const first = mergedRanges[0]!;
      if (first.start - block.start > maxGapSeconds) {
        const duration = first.start - block.start;
        gaps.push({ start: block.start, end: first.start, duration });
      }

      // Check gaps between ranges
      for (let i = 0; i < mergedRanges.length - 1; i++) {
        const curr = mergedRanges[i]!;
        const next = mergedRanges[i + 1]!;
        const duration = next.start - curr.end;
        if (duration > maxGapSeconds) {
          gaps.push({ start: curr.end, end: next.start, duration });
        }
      }

      // Check gap after last range
      const last = mergedRanges[mergedRanges.length - 1]!;
      if (block.end - last.end > maxGapSeconds) {
        const duration = block.end - last.end;
        gaps.push({ start: last.end, end: block.end, duration });
      }
    }

    if (gaps.length > 0) {
      report.ok = false;
    }

    report.blocks.push({
      blockId: block.blockId,
      sceneId: block.sceneId,
      recipeId: block.recipeId,
      renderPath: block.renderPath,
      start: block.start,
      end: block.end,
      ranges,
      gaps,
      warnings: blockWarnings
    });
  }

  return report;
}
