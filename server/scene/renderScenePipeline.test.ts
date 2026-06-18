import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentPlan, DirectorPlan, EditDecisionList, SceneRecipeId, ScreenCopyPlan, SemanticBlock, TranscriptJson } from "../../lib/types";
import {
  buildScreenCopyBlockSignatures,
  buildSemanticBlockSignatures,
} from "./renderScenePipelineSignatures";

const readFileMock = vi.fn();
const copyFileMock = vi.fn();
const buildDirectorPlanMock = vi.fn();
const buildScreenCopyPlanMock = vi.fn();
const writeJsonFileMock = vi.fn();
const composeFullSceneVideoMock = vi.fn();
const composeOverlayScenesMock = vi.fn();
const auditProjectEventMock = vi.fn();

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
  copyFile: copyFileMock,
}));

vi.mock("@/lib/storage", () => ({
  writeJsonFile: writeJsonFileMock,
}));

vi.mock("@/server/scene/directorPlanner", () => ({
  DIRECTOR_PLAN_VERSION: "v1",
  buildDirectorPlan: buildDirectorPlanMock,
}));

vi.mock("@/server/scene/screenCopyPlanner", () => ({
  SCREEN_COPY_PLAN_VERSION: "v2",
  buildScreenCopyPlan: buildScreenCopyPlanMock,
}));

vi.mock("@/server/scene/sceneCompatibility", () => ({
  resolveTemplateSceneCapabilities: vi.fn(() => ({
    templateId: "template-a",
    templateName: "Template A",
    allowedRecipeIds: ["hook_title_left", "hook_title_center"],
  })),
}));

vi.mock("@/server/scene/sceneCompiler", () => ({
  compileScenePlan: vi.fn(() => ({
    version: "v3",
    templateId: "template-a",
    styleProfileId: "clean_expert",
    planner: "deterministic",
    blocks: [],
    diagnostics: [],
  })),
  buildReviewScenePlan: vi.fn(() => ({
    version: "v1",
    templateId: "template-a",
    styleProfileId: "clean_expert",
    planner: "deterministic",
    semanticBlocks: [],
    blocks: [],
    diagnostics: [],
  })),
}));

vi.mock("@/server/scene/sceneCoverageValidator", () => ({
  validateCompiledSceneCoverage: vi.fn(() => ({
    ok: true,
    maxGapSeconds: 0.5,
    blocks: [],
  })),
}));

vi.mock("@/server/scene/fullSceneComposer", () => ({
  composeFullSceneVideo: composeFullSceneVideoMock,
}));

vi.mock("@/server/scene/overlayComposer", () => ({
  composeOverlayScenes: composeOverlayScenesMock,
}));

vi.mock("@/lib/audit", () => ({
  auditProjectEvent: auditProjectEventMock,
}));

vi.mock("@/server/scene/blockPlanner", () => ({
  buildSemanticBlocks: vi.fn(() => [makeSemanticBlock({ text: "Новая мысль", summary: "Новая мысль", start: 1, end: 3 })]),
}));

vi.mock("@/server/scene/renderScenePipelineSignatures", () => ({
  buildScreenCopyBlockSignatures,
  buildSemanticBlockSignatures,
}));

const { renderScenePipeline } = await import("./renderScenePipeline");

function makeSemanticBlock(overrides: Partial<SemanticBlock> = {}): SemanticBlock {
  return {
    id: "block-001",
    type: "hook",
    start: 0,
    end: 2,
    text: "Главная мысль",
    summary: "Главная мысль",
    words: [
      { word: "Главная", start: 0, end: 0.9 },
      { word: "мысль", start: 0.9, end: 2 },
    ],
    transcriptWordRange: { startIndex: 0, endIndex: 1 },
    wordCount: 2,
    ...overrides,
  };
}

describe("renderScenePipeline signatures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readFileMock.mockRejectedValue(new Error("missing"));
    copyFileMock.mockResolvedValue(undefined);
    writeJsonFileMock.mockResolvedValue(undefined);
    composeFullSceneVideoMock.mockResolvedValue(undefined);
    composeOverlayScenesMock.mockResolvedValue(undefined);
    auditProjectEventMock.mockResolvedValue(undefined);
  });

  it("invalidates reused director plan when semantic block text changes", () => {
    const baseBlocks = [makeSemanticBlock()];
    const changedBlocks = [makeSemanticBlock({ text: "Новая мысль", summary: "Новая мысль" })];

    const baseSignatures = buildSemanticBlockSignatures(baseBlocks, "template-a");
    const changedSignatures = buildSemanticBlockSignatures(changedBlocks, "template-a");

    expect(baseSignatures).not.toEqual(changedSignatures);
  });

  it("invalidates reused screen copy plan when director recipe changes", () => {
    const semanticBlocks = [makeSemanticBlock()];
    const basePlan: DirectorPlan = {
      version: "v1",
      templateId: "template-a",
      styleProfileId: "clean_expert",
      planner: "deterministic",
      semanticBlocks,
      blocks: [
        {
          id: "director-001",
          blockId: "block-001",
          blockType: "hook",
          sceneCategory: "overlay_scene",
          recipeId: "hook_title_left",
          speakerMode: "full_frame",
          intensity: "safe",
          scenePriority: "hero",
          sceneDensity: "minimal",
          visualRole: "hero_scene",
          holdStrategy: "readable_hold",
          transitionIn: "fade",
          transitionOut: "fade",
          start: 0,
          end: 2,
          planningConfidence: { level: "high", score: 0.9, reasons: [], escalationPolicy: "none" },
        },
      ],
    };
    const changedPlan: DirectorPlan = {
      ...basePlan,
      blocks: [
        {
          ...basePlan.blocks[0],
          recipeId: "hook_title_center",
        },
      ],
    };

    const baseSignatures = buildScreenCopyBlockSignatures(basePlan);
    const changedSignatures = buildScreenCopyBlockSignatures(changedPlan);

    expect(baseSignatures).not.toEqual(changedSignatures);
  });

  it("keeps identical signatures stable for reusable plans", () => {
    const semanticBlocks = [makeSemanticBlock()];
    const signaturesA = buildSemanticBlockSignatures(semanticBlocks, "template-a");
    const signaturesB = buildSemanticBlockSignatures(semanticBlocks, "template-a");

    expect(signaturesA).toEqual(signaturesB);
  });

  it("does not reuse stale director or screen-copy plans when signatures change but blockId stays the same", async () => {
    const semanticBlocks = [makeSemanticBlock({ text: "Новая мысль", summary: "Новая мысль", start: 1, end: 3 })];
    const newDirectorPlan: DirectorPlan = {
      version: "v1",
      templateId: "template-a",
      styleProfileId: "clean_expert",
      planner: "deterministic",
      semanticBlocks,
      semanticBlockSignatures: buildSemanticBlockSignatures(semanticBlocks, "template-a"),
      blocks: [
        {
          id: "director-001",
          blockId: "block-001",
          blockType: "hook",
          sceneCategory: "overlay_scene",
          recipeId: "hook_title_center",
          speakerMode: "full_frame",
          intensity: "safe",
          scenePriority: "hero",
          sceneDensity: "minimal",
          visualRole: "hero_scene",
          holdStrategy: "readable_hold",
          transitionIn: "fade",
          transitionOut: "fade",
          start: 1,
          end: 3,
          planningConfidence: { level: "high", score: 0.9, reasons: [], escalationPolicy: "none" },
        },
      ],
      diagnostics: [],
    };
    const newScreenCopyPlan: ScreenCopyPlan = {
      version: "v2",
      templateId: "template-a",
      styleProfileId: "clean_expert",
      planner: "deterministic",
      blocks: [
        {
          id: "copy-001",
          blockId: "block-001",
          recipeId: "hook_title_center",
          copyCompressionMode: "headline",
          payload: { title: "Новая мысль" },
          editableFields: ["title"],
          planningConfidence: { level: "high", score: 0.9, reasons: [], escalationPolicy: "none" },
        },
      ],
      blockSignatures: buildScreenCopyBlockSignatures(newDirectorPlan),
      diagnostics: [],
    };
    const oldDirectorPlan: DirectorPlan = {
      ...newDirectorPlan,
      semanticBlocks: [makeSemanticBlock({ text: "Старая мысль", summary: "Старая мысль", start: 0, end: 2 })],
      semanticBlockSignatures: buildSemanticBlockSignatures(
        [makeSemanticBlock({ text: "Старая мысль", summary: "Старая мысль", start: 0, end: 2 })],
        "template-a"
      ),
      blocks: [{ ...newDirectorPlan.blocks[0], recipeId: "hook_title_left" as SceneRecipeId, start: 0, end: 2 }],
    };
    const oldScreenCopyPlan: ScreenCopyPlan = {
      ...newScreenCopyPlan,
      blocks: [{ ...newScreenCopyPlan.blocks[0], recipeId: "hook_title_left" as SceneRecipeId, payload: { title: "Старая мысль" } }],
      blockSignatures: buildScreenCopyBlockSignatures(oldDirectorPlan),
    };
    const contentPlan: ContentPlan = {
      hook: "Новая мысль",
      keyPhrases: [],
      titleSuggestions: [],
      description: "",
      hashtags: [],
      motionInserts: [],
    };
    const transcript: TranscriptJson = {
      language: "ru",
      segments: [],
    };
    const edl: EditDecisionList = {
      keptRanges: [],
      removedRanges: [],
    };

    readFileMock.mockImplementation(async (filePath: string) => {
      if (filePath.endsWith("director-plan.json")) return JSON.stringify(oldDirectorPlan);
      if (filePath.endsWith("screen-copy-plan.json")) return JSON.stringify(oldScreenCopyPlan);
      throw new Error("missing");
    });
    buildDirectorPlanMock.mockResolvedValue(newDirectorPlan);
    buildScreenCopyPlanMock.mockResolvedValue(newScreenCopyPlan);

    await renderScenePipeline({
      projectId: "project-001",
      paths: {
        project: "/tmp/project-001",
        cleanVideo: "/tmp/project-001/clean.mp4",
        semanticBlocks: "/tmp/project-001/semantic-blocks.json",
        directorPlan: "/tmp/project-001/director-plan.json",
        screenCopyPlan: "/tmp/project-001/screen-copy-plan.json",
        scenePlan: "/tmp/project-001/scene-plan.json",
        compiledScenePlan: "/tmp/project-001/compiled-scene-plan.json",
        sceneCoverageReport: "/tmp/project-001/scene-coverage-report.json",
        cinematicComposedVideo: "/tmp/project-001/cinematic-composed.mp4",
        semanticOverlayMp4: "/tmp/project-001/semantic-overlay.mp4",
      } as ReturnType<typeof import("@/lib/storage").pathsForProject>,
      transcript,
      edl,
      subtitles: [
        {
          id: "sub-001",
          start: 1,
          end: 3,
          text: "Новая мысль",
          words: [
            { word: "Новая", start: 1, end: 2 },
            { word: "мысль", start: 2, end: 3 },
          ],
          highlightedWords: [],
        },
      ],
      contentPlan,
      stylePreset: "clean_expert",
      presentationMode: "cinematic_scenes",
      profile: { orientation: "landscape", width: 1920, height: 1080 },
      duration: 3,
      renderProfile: "review",
      styleOptions: { visualTemplateId: "template-a" },
    });

    expect(buildDirectorPlanMock).toHaveBeenCalledTimes(1);
    expect(buildScreenCopyPlanMock).toHaveBeenCalledTimes(1);
  });
});
