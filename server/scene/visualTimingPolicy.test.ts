import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type {
  CompiledScenePlan,
  DirectorPlan,
  SceneRecipeId,
  ScreenCopyPlan,
  SemanticBlock,
  TranscriptWord,
  VisualFrameProfile
} from "@/lib/types";
import { applyVisualTimingPolicy } from "./visualTimingPolicy";
import { buildVisualTimelineTrace } from "./visualTimelineTrace";

vi.mock("@/server/scene/sceneLibrary", () => ({
  getSceneRecipe: (recipeId: SceneRecipeId) => ({
    id: recipeId,
    category: "overlay_scene",
    allowedLayouts: ["center", "lower_third"],
    duration: { min: 1, max: 6 },
    visualMapping: { overlayTemplateId: "lesson_title", overlayPresetId: "lesson_title_block" },
    requiredSlotRoles: ["headline"],
    payloadSchema: z.object({ title: z.string().optional(), text: z.string().optional() }).passthrough()
  })
}));

vi.mock("@/server/scene/sceneRecipeRuntime", () => ({
  buildSceneRecipeRuntime: (recipeId: SceneRecipeId) => ({
    recipeId,
    recipeDef: {
      id: recipeId,
      category: "overlay_scene",
      allowedLayouts: ["center", "lower_third"],
      duration: { min: 1, max: 6 },
      visualMapping: { overlayTemplateId: "lesson_title", overlayPresetId: "lesson_title_block" },
      requiredSlotRoles: ["headline"],
      payloadSchema: z.object({ title: z.string().optional(), text: z.string().optional() }).passthrough()
    },
    overlayRole: "semantic_accent",
    fullScenePresetId: recipeId
  })
}));

vi.mock("@/server/scene/microBeatPlanner", () => ({
  buildMicroBeatsFromSemanticPayload: () => [],
  buildMicroBeatsForBlock: (_semanticBlock: SemanticBlock, words: TranscriptWord[]) => [
    {
      id: "beat-1",
      type: "speech_phrase",
      start: words[3]?.start ?? 1.4,
      end: words[4]?.end ?? 2.2,
      anchorText: "ключевая часть"
    }
  ]
}));

const { compileScenePlan } = await import("./sceneCompiler");

describe("visualTimingPolicy", () => {
  it("primary overlay shorter than phrase gets extended", () => {
    const [result] = applyVisualTimingPolicy({
      blockStart: 0,
      blockEnd: 5.8,
      renderPath: "overlay",
      scenePriority: "hero",
      recipeId: "hook_title_center",
      cleanWords: makeWords(0, 5.8, 8),
      objects: [
        {
          object: { id: "primary", start: 0, duration: 0.5 },
          objectKind: "primary"
        }
      ]
    });

    expect(result.object.start).toBe(0);
    expect(result.object.duration).toBeGreaterThanOrEqual(2.4);
    expect(result.metadata.timingPolicyApplied).toBe(true);
    expect(result.metadata.adjustedObjectEnd).toBeLessThanOrEqual(5.8);
  });

  it("support overlay gets safe minimum duration", () => {
    const [result] = applyVisualTimingPolicy({
      blockStart: 0,
      blockEnd: 5,
      renderPath: "overlay",
      scenePriority: "support",
      recipeId: "hook_title_center",
      cleanWords: makeWords(0, 5, 8),
      objects: [
        {
          object: { id: "support", start: 1.2, duration: 0.4 },
          objectKind: "support"
        }
      ]
    });

    expect(result.object.duration).toBeGreaterThanOrEqual(1.6);
    expect(result.object.start).toBeGreaterThanOrEqual(0);
    expect(result.metadata.adjustedObjectEnd).toBeLessThanOrEqual(5);
  });

  it("short block is not over-expanded", () => {
    const [result] = applyVisualTimingPolicy({
      blockStart: 0,
      blockEnd: 1.3,
      renderPath: "overlay",
      scenePriority: "hero",
      recipeId: "hook_title_center",
      cleanWords: makeWords(0, 1.3, 3),
      objects: [
        {
          object: { id: "primary", start: 0.4, duration: 0.3 },
          objectKind: "primary"
        }
      ]
    });

    expect(result.object.duration).toBeLessThanOrEqual(1.3);
    expect(result.object.duration).toBeGreaterThanOrEqual(0.72);
    expect(result.object.start).toBe(0);
  });

  it("multiple objects in same block do not exceed block bounds", () => {
    const results = applyVisualTimingPolicy({
      blockStart: 0,
      blockEnd: 5.8,
      renderPath: "overlay",
      scenePriority: "hero",
      recipeId: "hook_title_center",
      cleanWords: makeWords(0, 5.8, 9),
      objects: [
        { object: { id: "primary", start: 0, duration: 0.5 }, objectKind: "primary" },
        { object: { id: "support-1", start: 1.4, duration: 0.42 }, objectKind: "support" },
        { object: { id: "support-2", start: 3.1, duration: 0.42 }, objectKind: "support" }
      ]
    });

    const sorted = results.map((result) => result.object).sort((left, right) => left.start - right.start);
    expect(sorted.every((object) => object.start >= 0)).toBe(true);
    expect(sorted.every((object) => object.start + object.duration <= 5.8)).toBe(true);
    expect(sorted.every((object) => object.duration > 0)).toBe(true);
    expect(sorted[0]?.start).toBe(0);
  });

  it("visual trace warning improves after compile-time timing policy", () => {
    const semanticBlock = makeSemanticBlock({
      end: 5.8,
      text: "Это длинная фраза которая должна держаться на экране заметно дольше",
      summary: "Это длинная фраза которая должна держаться на экране заметно дольше",
      words: makeWords(0, 5.8, 8)
    });
    const directorPlan = makeDirectorPlan(semanticBlock);
    const screenCopyPlan = makeScreenCopyPlan(semanticBlock.id);
    const frame: VisualFrameProfile = { orientation: "landscape", width: 1920, height: 1080 };

    const compiled = compileScenePlan(directorPlan, screenCopyPlan, frame);
    const trace = buildVisualTimelineTrace({
      transcript: { language: "ru", segments: [] },
      subtitles: [
        {
          id: "sub-1",
          start: semanticBlock.start,
          end: semanticBlock.end,
          text: semanticBlock.text,
          words: semanticBlock.words,
          highlightedWords: []
        }
      ],
      directorPlan,
      screenCopyPlan,
      compiledScenePlan: compiled as CompiledScenePlan
    });

    const primary = compiled.blocks[0]?.overlayBeats[0] as ({
      duration: number;
      timingPolicy?: { timingPolicyApplied?: boolean };
    } | undefined);
    expect(primary?.duration ?? 0).toBeGreaterThanOrEqual(2.4);
    expect(primary?.timingPolicy?.timingPolicyApplied).toBe(true);
    expect(trace.items[0]?.warnings).not.toContain("visual_too_short_for_phrase");
    expect(trace.items[0]?.timingPolicyApplied).toBe(true);
  });
});

function makeWords(start: number, end: number, count: number): TranscriptWord[] {
  const slice = (end - start) / count;
  return Array.from({ length: count }, (_, index) => {
    const wordStart = round(start + slice * index);
    return {
      word: `слово${index + 1}`,
      start: wordStart,
      end: round(index === count - 1 ? end : wordStart + slice * 0.9)
    };
  });
}

function makeSemanticBlock(overrides: Partial<SemanticBlock> = {}): SemanticBlock {
  return {
    id: "block-1",
    type: "hook",
    start: 0,
    end: 5.8,
    text: "Длинная фраза для timing policy",
    summary: "Длинная фраза для timing policy",
    words: makeWords(0, 5.8, 8),
    transcriptWordRange: { startIndex: 0, endIndex: 7 },
    wordCount: 8,
    ...overrides
  };
}

function makeDirectorPlan(semanticBlock: SemanticBlock): DirectorPlan {
  return {
    version: "v1",
    templateId: "template-a",
    styleProfileId: "clean_expert",
    planner: "deterministic",
    semanticBlocks: [semanticBlock],
    blocks: [
      {
        id: "director-1",
        blockId: semanticBlock.id,
        blockType: semanticBlock.type,
        sceneCategory: "overlay_scene",
        recipeId: "hook_title_center",
        fallbackRecipeId: "hook_title_left",
        speakerMode: "full_frame",
        intensity: "safe",
        scenePriority: "hero",
        sceneDensity: "minimal",
        visualRole: "hero_scene",
        holdStrategy: "readable_hold",
        transitionIn: "fade",
        transitionOut: "fade",
        start: semanticBlock.start,
        end: semanticBlock.end,
        planningConfidence: { level: "high", score: 0.9, reasons: [], escalationPolicy: "none" }
      }
    ]
  };
}

function makeScreenCopyPlan(blockId: string): ScreenCopyPlan {
  return {
    version: "v2",
    templateId: "template-a",
    styleProfileId: "clean_expert",
    planner: "deterministic",
    blocks: [
      {
        id: "copy-1",
        blockId,
        recipeId: "hook_title_center",
        copyCompressionMode: "headline",
        payload: {
          title: "Длинная фраза",
          text: "Длинная фраза",
        },
        editableFields: ["title", "text"],
        planningConfidence: { level: "high", score: 0.9, reasons: [], escalationPolicy: "none" }
      }
    ]
  };
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
