import { describe, expect, it } from "vitest";
import { validateCompiledSceneCoverage } from "./sceneCoverageValidator";
import type { CompiledScenePlan, CompiledSceneBlock, VisualScene, VisualBeat } from "@/lib/types";

function createBlock(id: string, start: number, end: number, fullScene?: VisualScene, overlayBeats?: VisualBeat[]): CompiledSceneBlock {
  return {
    id: `compiled-${id}`,
    blockId: id,
    sceneId: id,
    blockType: "explanation",
    sceneCategory: "overlay_scene",
    recipeId: "hook_title_left",
    speakerMode: "full_frame",
    start,
    end,
    duration: end - start,
    renderPath: fullScene ? "full_scene" : "overlay",
    activeLayerIds: [],
    summary: "test",
    screenCopy: {},
    overlayBeats: overlayBeats ?? [],
    fullScene,
    microBeats: [],
    fallbackApplied: false,
    planningConfidence: { level: "high", score: 1, reasons: [], escalationPolicy: "none" },
    scenePriority: "hero",
    sceneDensity: "balanced",
    visualRole: "hero_scene",
    holdStrategy: "readable_hold"
  };
}

describe("validateCompiledSceneCoverage", () => {
  it("Test 1 — no gaps", () => {
    const plan: CompiledScenePlan = {
      version: "v3",
      planner: "ai",
      styleProfileId: "clean_expert",
      blocks: [
        createBlock("block1", 0, 6, undefined, [
          { id: "o1", start: 0, duration: 5 } as VisualBeat,
          { id: "o2", start: 5.1, duration: 0.9 } as VisualBeat
        ])
      ]
    };
    const report = validateCompiledSceneCoverage(plan, { maxGapSeconds: 0.8 });
    expect(report.ok).toBe(true);
    expect(report.blocks[0]?.gaps.length).toBe(0);
  });

  it("Test 2 — detects big gap", () => {
    const plan: CompiledScenePlan = {
      version: "v3",
      planner: "ai",
      styleProfileId: "clean_expert",
      blocks: [
        createBlock("block1", 0, 6, undefined, [
          { id: "o1", start: 0, duration: 1 } as VisualBeat,
          { id: "o2", start: 5, duration: 1 } as VisualBeat
        ])
      ]
    };
    const report = validateCompiledSceneCoverage(plan, { maxGapSeconds: 0.8 });
    expect(report.ok).toBe(false);
    expect(report.blocks[0]?.gaps.length).toBe(1);
    expect(report.blocks[0]?.gaps[0]).toEqual({ start: 1, end: 5, duration: 4 });
  });

  it("Test 3 — fullScene covers block", () => {
    const plan: CompiledScenePlan = {
      version: "v3",
      planner: "ai",
      styleProfileId: "clean_expert",
      blocks: [
        createBlock("block1", 0, 6, { id: "fs1", start: 0, duration: 6 } as VisualScene)
      ]
    };
    const report = validateCompiledSceneCoverage(plan, { maxGapSeconds: 0.8 });
    expect(report.ok).toBe(true);
    expect(report.blocks[0]?.gaps.length).toBe(0);
  });

  it("Test 4 — overlay starts late", () => {
    const plan: CompiledScenePlan = {
      version: "v3",
      planner: "ai",
      styleProfileId: "clean_expert",
      blocks: [
        createBlock("block1", 0, 6, undefined, [
          { id: "o1", start: 3, duration: 3 } as VisualBeat
        ])
      ]
    };
    const report = validateCompiledSceneCoverage(plan, { maxGapSeconds: 0.8 });
    expect(report.ok).toBe(false);
    expect(report.blocks[0]?.gaps.length).toBe(1);
    expect(report.blocks[0]?.gaps[0]).toEqual({ start: 0, end: 3, duration: 3 });
  });

  it("Test 5 — overlay exceeds block", () => {
    const plan: CompiledScenePlan = {
      version: "v3",
      planner: "ai",
      styleProfileId: "clean_expert",
      blocks: [
        createBlock("block1", 0, 6, undefined, [
          { id: "o1", start: -0.2, duration: 6.7 } as VisualBeat
        ])
      ]
    };
    const report = validateCompiledSceneCoverage(plan, { maxGapSeconds: 0.8 });
    expect(report.ok).toBe(true); // Gaps are OK
    expect(report.blocks[0]?.warnings).toContain("Overlay beat o1 exceeds block boundaries");
  });
});
