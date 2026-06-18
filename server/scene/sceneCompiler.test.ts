import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { DirectorPlan, SceneRecipeId, ScreenCopyPlan, SemanticBlock, VisualFrameProfile } from "../../lib/types";
import { buildSceneRecipeRuntime } from "./sceneRecipeRuntime";
import { buildMicroBeatsForBlock, buildMicroBeatsFromSemanticPayload } from "./microBeatPlanner";

vi.mock("@/server/scene/sceneLibrary", () => ({
  getSceneRecipe: (recipeId: SceneRecipeId) => {
    const recipes: Record<SceneRecipeId, {
      id: SceneRecipeId;
      category: "overlay_scene" | "split_scene" | "pip_scene" | "full_graphic_scene" | "camera_emphasis_scene" | "transition_scene";
      allowedLayouts: Array<"left" | "right" | "center" | "lower_third" | "full_frame">;
      duration: { min: number; max: number };
      visualMapping: Record<string, unknown>;
      requiredSlotRoles: string[];
      fallbackRecipeId?: SceneRecipeId;
      payloadSchema: z.ZodType<Record<string, unknown>>;
    }> = {
      hook_title_left: { id: "hook_title_left", category: "overlay_scene", allowedLayouts: ["left"], duration: { min: 1, max: 4 }, visualMapping: { overlayTemplateId: "lesson_title", overlayPresetId: "lesson_title_block" }, requiredSlotRoles: ["headline"], fallbackRecipeId: "hook_title_center", payloadSchema: z.object({ title: z.string(), subtitle: z.string().optional() }).passthrough() },
      hook_title_center: { id: "hook_title_center", category: "overlay_scene", allowedLayouts: ["center"], duration: { min: 1, max: 4 }, visualMapping: { overlayTemplateId: "lesson_title", overlayPresetId: "lesson_title_cinematic" }, requiredSlotRoles: ["headline"], fallbackRecipeId: "hook_title_left", payloadSchema: z.object({ title: z.string(), subtitle: z.string().optional() }).passthrough() },
      headline_with_accent_number: { id: "headline_with_accent_number", category: "overlay_scene", allowedLayouts: ["left"], duration: { min: 1, max: 4 }, visualMapping: {}, requiredSlotRoles: ["headline"], payloadSchema: z.object({ value: z.string(), title: z.string(), text: z.string().optional() }).passthrough() },
      step_number_callout: { id: "step_number_callout", category: "overlay_scene", allowedLayouts: ["left"], duration: { min: 1, max: 4 }, visualMapping: {}, requiredSlotRoles: ["step_index"], payloadSchema: z.object({ value: z.string(), label: z.string(), text: z.string().optional() }).passthrough() },
      before_after_phrase_swap: { id: "before_after_phrase_swap", category: "overlay_scene", allowedLayouts: ["left"], duration: { min: 1, max: 4 }, visualMapping: {}, requiredSlotRoles: ["comparison_left", "comparison_right"], payloadSchema: z.object({ left: z.string(), right: z.string(), caption: z.string().optional() }).passthrough() },
      rule_card: { id: "rule_card", category: "overlay_scene", allowedLayouts: ["left"], duration: { min: 1, max: 4 }, visualMapping: {}, requiredSlotRoles: ["headline"], payloadSchema: z.object({ title: z.string(), subtitle: z.string().optional(), text: z.string().optional() }).passthrough() },
      list_progression: { id: "list_progression", category: "overlay_scene", allowedLayouts: ["left"], duration: { min: 1, max: 4 }, visualMapping: {}, requiredSlotRoles: ["headline"], payloadSchema: z.object({ title: z.string().optional(), items: z.array(z.string()).min(2) }).passthrough() },
      big_number_grow: { id: "big_number_grow", category: "overlay_scene", allowedLayouts: ["left"], duration: { min: 1, max: 4 }, visualMapping: {}, requiredSlotRoles: ["hero_number"], payloadSchema: z.object({ value: z.string(), label: z.string() }).passthrough() },
      big_number_plus_text_plate: { id: "big_number_plus_text_plate", category: "overlay_scene", allowedLayouts: ["left"], duration: { min: 1, max: 4 }, visualMapping: {}, requiredSlotRoles: ["hero_number"], payloadSchema: z.object({ value: z.string(), label: z.string(), text: z.string().optional() }).passthrough() },
      warning_strike_fix: { id: "warning_strike_fix", category: "overlay_scene", allowedLayouts: ["left"], duration: { min: 1, max: 4 }, visualMapping: {}, requiredSlotRoles: ["wrong_phrase", "correct_phrase"], payloadSchema: z.object({ falseText: z.string(), trueText: z.string(), label: z.string().optional(), value: z.string().optional() }).passthrough() },
      hotkey_command_tip: { id: "hotkey_command_tip", category: "overlay_scene", allowedLayouts: ["left"], duration: { min: 1, max: 4 }, visualMapping: {}, requiredSlotRoles: ["command_hotkey"], payloadSchema: z.object({ title: z.string(), cta: z.string(), label: z.string().optional(), text: z.string().optional() }).passthrough() },
      myth_vs_truth: { id: "myth_vs_truth", category: "overlay_scene", allowedLayouts: ["left"], duration: { min: 1, max: 4 }, visualMapping: {}, requiredSlotRoles: ["wrong_phrase", "correct_phrase"], payloadSchema: z.object({ falseText: z.string(), trueText: z.string(), label: z.string().optional() }).passthrough() },
      definition_card: { id: "definition_card", category: "overlay_scene", allowedLayouts: ["left"], duration: { min: 1, max: 4 }, visualMapping: {}, requiredSlotRoles: ["headline"], payloadSchema: z.object({ title: z.string(), text: z.string(), items: z.array(z.string()).optional() }).passthrough() },
      comparison_split: { id: "comparison_split", category: "split_scene", allowedLayouts: ["full_frame"], duration: { min: 2, max: 6 }, visualMapping: { fullSceneType: "compare_split", layoutMode: "split" }, requiredSlotRoles: ["comparison_left", "comparison_right"], fallbackRecipeId: "speaker_right_panel_left_infographic", payloadSchema: z.object({ left: z.string(), right: z.string(), caption: z.string().optional() }).passthrough() },
      checklist_reveal: { id: "checklist_reveal", category: "overlay_scene", allowedLayouts: ["left"], duration: { min: 1, max: 4 }, visualMapping: {}, requiredSlotRoles: ["headline"], payloadSchema: z.object({ title: z.string().optional(), items: z.array(z.string()).min(2) }).passthrough() },
      timeline_year_callout: { id: "timeline_year_callout", category: "overlay_scene", allowedLayouts: ["left"], duration: { min: 1, max: 4 }, visualMapping: {}, requiredSlotRoles: ["headline"], payloadSchema: z.object({ title: z.string(), items: z.array(z.string()).min(2) }).passthrough() },
      trust_diagram: { id: "trust_diagram", category: "pip_scene", allowedLayouts: ["full_frame"], duration: { min: 2, max: 6 }, visualMapping: { fullSceneType: "trust_map", layoutMode: "pip" }, requiredSlotRoles: ["comparison_left", "comparison_right"], payloadSchema: z.object({ center: z.string(), left: z.string(), right: z.string(), caption: z.string().optional() }).passthrough() },
      quote_emphasis: { id: "quote_emphasis", category: "overlay_scene", allowedLayouts: ["center"], duration: { min: 1, max: 4 }, visualMapping: {}, requiredSlotRoles: ["quote_pull"], payloadSchema: z.object({ quote: z.string(), label: z.string().optional() }).passthrough() },
      cta_finish: { id: "cta_finish", category: "overlay_scene", allowedLayouts: ["center"], duration: { min: 1, max: 4 }, visualMapping: { overlayTemplateId: "cta_plate", overlayPresetId: "cta_finish_clean" }, requiredSlotRoles: ["cta_phrase"], fallbackRecipeId: "hook_title_center", payloadSchema: z.object({ text: z.string(), label: z.string().optional() }).passthrough() },
      speaker_lower_half_top_visual: { id: "speaker_lower_half_top_visual", category: "split_scene", allowedLayouts: ["full_frame"], duration: { min: 2, max: 6 }, visualMapping: { fullSceneType: "timeline_steps", layoutMode: "full_frame" }, requiredSlotRoles: ["headline"], payloadSchema: z.object({ title: z.string(), subtitle: z.string().optional(), items: z.array(z.string()).optional() }).passthrough() },
      speaker_right_panel_left_infographic: { id: "speaker_right_panel_left_infographic", category: "pip_scene", allowedLayouts: ["full_frame"], duration: { min: 2, max: 6 }, visualMapping: { fullSceneType: "stat_hud", layoutMode: "pip" }, requiredSlotRoles: ["headline"], fallbackRecipeId: "speaker_lower_half_top_visual", payloadSchema: z.object({ title: z.string(), label: z.string().optional(), value: z.string().optional(), items: z.array(z.string()).optional() }).passthrough() },
      voiceover_full_graphic: { id: "voiceover_full_graphic", category: "full_graphic_scene", allowedLayouts: ["full_frame"], duration: { min: 2, max: 6 }, visualMapping: { fullSceneType: "three_cards", layoutMode: "full_frame" }, requiredSlotRoles: ["headline"], payloadSchema: z.object({ title: z.string(), items: z.array(z.string()).optional(), text: z.string().optional() }).passthrough() },
      camera_punch_in: { id: "camera_punch_in", category: "camera_emphasis_scene", allowedLayouts: ["full_frame"], duration: { min: 1, max: 4 }, visualMapping: { fullSceneType: "pip_slide", layoutMode: "overlay" }, requiredSlotRoles: ["headline"], payloadSchema: z.object({ title: z.string(), text: z.string().optional() }).passthrough() },
      clean_section_transition: { id: "clean_section_transition", category: "transition_scene", allowedLayouts: ["center"], duration: { min: 1, max: 2 }, visualMapping: { overlayTemplateId: "keyword_slam", overlayPresetId: "keyword_warning_strip" }, requiredSlotRoles: ["headline"], payloadSchema: z.object({ title: z.string() }).passthrough() },
    };
    return recipes[recipeId];
  },
}));

vi.mock("@/server/scene/microBeatPlanner", () => ({
  buildMicroBeatsForBlock,
  buildMicroBeatsFromSemanticPayload,
}));

vi.mock("@/server/scene/sceneRecipeRuntime", () => ({
  buildSceneRecipeRuntime,
}));

const { compileScenePlan } = await import("./sceneCompiler");
const { guardScenePayload } = await import("./scenePayloadGuards");

const frame: VisualFrameProfile = {
  orientation: "landscape",
  width: 1920,
  height: 1080,
};

function makeSemanticBlock(overrides: Partial<SemanticBlock> = {}): SemanticBlock {
  return {
    id: "block-001",
    type: "hook",
    start: 0,
    end: 2.4,
    text: "Главная мысль",
    summary: "Главная мысль",
    words: [
      { word: "Главная", start: 0, end: 0.9 },
      { word: "мысль", start: 0.9, end: 1.8 },
    ],
    transcriptWordRange: { startIndex: 0, endIndex: 1 },
    wordCount: 2,
    ...overrides,
  };
}

function makeDirectorPlan(overrides: Partial<DirectorPlan["blocks"][number]> = {}): DirectorPlan {
  const semanticBlocks = [makeSemanticBlock()];
  return {
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
        recipeId: "cta_finish",
        fallbackRecipeId: "hook_title_center",
        speakerMode: "full_frame",
        intensity: "safe",
        scenePriority: "hero",
        sceneDensity: "minimal",
        visualRole: "hero_scene",
        holdStrategy: "readable_hold",
        transitionIn: "fade",
        transitionOut: "fade",
        start: 0,
        end: 2.4,
        planningConfidence: { level: "high", score: 0.9, reasons: [], escalationPolicy: "none" },
        ...overrides,
      },
    ],
  };
}

function makeScreenCopyPlan(payload: ScreenCopyPlan["blocks"][number]["payload"], recipeId: SceneRecipeId = "cta_finish"): ScreenCopyPlan {
  return {
    version: "v2",
    templateId: "template-a",
    styleProfileId: "clean_expert",
    planner: "deterministic",
    blocks: [
      {
        id: "copy-block-001",
        blockId: "block-001",
        recipeId,
        copyCompressionMode: "headline",
        payload,
        editableFields: ["title"],
        planningConfidence: { level: "high", score: 0.9, reasons: [], escalationPolicy: "none" },
      },
    ],
  };
}

describe("sceneRecipeRuntime", () => {
  it("uses validated fallback recipe for overlay runtime context", () => {
    const runtime = buildSceneRecipeRuntime(
      "cta_finish",
      {
        title: "Главная мысль",
        slots: [
          {
            id: "slot-headline",
            role: "headline",
            text: "Главная мысль",
            style: "primary",
            start: 0,
            end: 1.4,
          },
        ],
      },
      "hook_title_center"
    );

    expect(runtime.recipeId).toBe("hook_title_center");
    expect(runtime.recipeDef.visualMapping.overlayTemplateId).toBe("lesson_title");
    expect(runtime.overlayRole).toBe("semantic_accent");
  });

  it("uses validated fallback recipe for full-scene runtime context", () => {
    const runtime = buildSceneRecipeRuntime(
      "comparison_split",
      {
        title: "Система",
        slots: [
          {
            id: "slot-headline",
            role: "headline",
            text: "Система",
            style: "primary",
            start: 0,
            end: 1.2,
          },
        ],
      },
      "speaker_right_panel_left_infographic"
    );

    expect(runtime.recipeId).toBe("speaker_right_panel_left_infographic");
    expect(runtime.fullScenePresetId).toBe("speaker_right_panel_left_infographic");
    expect(runtime.recipeDef.visualMapping.fullSceneType).toBe("stat_hud");
  });

  it("compileScenePlan uses fallback overlay recipe for runtime overlay fields", () => {
    const semanticBlocks = [makeSemanticBlock()];
    const directorPlan = {
      ...makeDirectorPlan(),
      semanticBlocks,
    };
    const screenCopyPlan = makeScreenCopyPlan({
      title: "Главная мысль",
      slots: [
        {
          id: "slot-headline",
          role: "headline",
          text: "Главная мысль",
          style: "primary",
          start: 0,
          end: 1.4,
        },
      ],
    });

    const compiled = compileScenePlan(directorPlan, screenCopyPlan, frame);
    const block = compiled.blocks[0];

    expect(block.recipeId).toBe("hook_title_center");
    expect(block.overlayBeats[0]?.templateId).toBe("lesson_title");
    expect(block.overlayBeats[0]?.role).toBe("semantic_accent");
    expect(block.overlayBeats[0]?.presetId).toBe("lesson_title_cinematic");
  });

  it("compileScenePlan uses fallback full-scene recipe for runtime full-scene and microbeat fields", () => {
    const semanticBlocks = [makeSemanticBlock({ type: "comparison", text: "5x быстрее", summary: "5x быстрее" })];
    const directorPlan = {
      ...makeDirectorPlan({
        blockType: "comparison",
        sceneCategory: "split_scene",
        recipeId: "comparison_split",
        fallbackRecipeId: "speaker_right_panel_left_infographic",
        speakerMode: "pip",
        scenePriority: "support",
        visualRole: "support_overlay",
      }),
      semanticBlocks,
    };
    const screenCopyPlan = makeScreenCopyPlan({
      title: "Система",
      value: "5x",
      label: "быстрее",
      slots: [
        {
          id: "slot-number",
          role: "hero_number",
          text: "5x",
          style: "accent",
          start: 0,
          end: 0.8,
        },
      ],
    }, "comparison_split");

    const compiled = compileScenePlan(directorPlan, screenCopyPlan, frame);
    const block = compiled.blocks[0];

    expect(block.recipeId).toBe("speaker_right_panel_left_infographic");
    expect(block.fullScene?.presetId).toBe("speaker_right_panel_left_infographic");
    expect(block.fullScene?.sceneType).toBe("stat_hud");
    expect(block.microBeats[0]?.type).toBe("number_emphasis");
  });

  it("downgrades weak full-scene payload to safe overlay recipe instead of keeping a decorative card", () => {
    const semanticBlocks = [makeSemanticBlock({ type: "proof", text: "Нужен внятный вывод", summary: "Нужен внятный вывод" })];
    const directorPlan = {
      ...makeDirectorPlan({
        blockType: "proof",
        sceneCategory: "pip_scene",
        recipeId: "trust_diagram",
        fallbackRecipeId: "speaker_right_panel_left_infographic",
        speakerMode: "pip",
        scenePriority: "support",
        visualRole: "support_overlay",
      }),
      semanticBlocks,
    };
    const screenCopyPlan = makeScreenCopyPlan({
      center: "TRUST",
      value: "01",
      title: "  ",
      text: "Нужен внятный вывод",
      slots: [
        {
          id: "slot-headline",
          role: "headline",
          text: "Нужен внятный вывод",
          style: "primary",
          start: 0,
          end: 1.2,
        },
      ],
    }, "trust_diagram");

    const compiled = compileScenePlan(directorPlan, screenCopyPlan, frame);
    const block = compiled.blocks[0];

    expect(block.recipeId).toBe("hook_title_center");
    expect(block.renderPath).toBe("overlay");
    expect(block.fullScene).toBeUndefined();
    expect(block.screenCopy.title).toBe("Нужен внятный вывод");
    expect(block.screenCopy.center).toBeUndefined();
  });

  it("keeps short comparison pair 'До / После' without downgrade", () => {
    const result = guardScenePayload({
      recipeId: "comparison_split",
      payload: { left: "До", right: "После" },
      summary: "До После"
    });

    expect(result.recipeId).toBe("comparison_split");
  });

  it("keeps short comparison pair 'Да / Нет' without downgrade", () => {
    const result = guardScenePayload({
      recipeId: "comparison_split",
      payload: { left: "Да", right: "Нет" },
      summary: "Да Нет"
    });

    expect(result.recipeId).toBe("comparison_split");
  });

  it("keeps short comparison pair 'Можно / Нельзя' without downgrade", () => {
    const result = guardScenePayload({
      recipeId: "comparison_split",
      payload: { left: "Можно", right: "Нельзя" },
      summary: "Можно Нельзя"
    });

    expect(result.recipeId).toBe("comparison_split");
  });

  it("keeps short accent phrase 'Рост x2' for quote/accent recipe", () => {
    const result = guardScenePayload({
      recipeId: "quote_emphasis",
      payload: { quote: "Рост x2" },
      summary: "Рост x2"
    });

    expect(result.recipeId).toBe("quote_emphasis");
  });

  it("keeps short title payload '3 ошибки' without downgrade", () => {
    const result = guardScenePayload({
      recipeId: "hook_title_center",
      payload: { title: "3 ошибки" },
      summary: "3 ошибки"
    });

    expect(result.recipeId).toBe("hook_title_center");
  });

  it("keeps short title payload 'Цена ошибки' without downgrade", () => {
    const result = guardScenePayload({
      recipeId: "hook_title_center",
      payload: { title: "Цена ошибки" },
      summary: "Цена ошибки"
    });

    expect(result.recipeId).toBe("hook_title_center");
  });
});
