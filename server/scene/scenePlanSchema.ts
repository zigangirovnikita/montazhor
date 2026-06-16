import { z } from "zod";

export const semanticBlockTypeSchema = z.enum([
  "hook",
  "thesis",
  "explanation",
  "definition",
  "example",
  "comparison",
  "myth_vs_truth",
  "proof",
  "timeline",
  "list",
  "warning",
  "cta",
  "transition"
]);

export const sceneCategorySchema = z.enum([
  "overlay_scene",
  "split_scene",
  "pip_scene",
  "full_graphic_scene",
  "camera_emphasis_scene",
  "transition_scene"
]);

export const sceneRecipeIdSchema = z.enum([
  "hook_title_left",
  "hook_title_center",
  "headline_with_accent_number",
  "step_number_callout",
  "big_number_grow",
  "big_number_plus_text_plate",
  "warning_strike_fix",
  "hotkey_command_tip",
  "myth_vs_truth",
  "definition_card",
  "comparison_split",
  "checklist_reveal",
  "timeline_year_callout",
  "trust_diagram",
  "quote_emphasis",
  "cta_finish",
  "speaker_lower_half_top_visual",
  "speaker_right_panel_left_infographic",
  "voiceover_full_graphic",
  "camera_punch_in",
  "clean_section_transition"
]);

export const speakerModeSchema = z.enum(["full_frame", "reframed", "pip", "hidden"]);
export const sceneIntensitySchema = z.enum(["safe", "balanced", "strong"]);
export const sceneTransitionSchema = z.enum(["fade", "slide", "zoom", "wipe", "cut"]);
export const planningConfidenceLevelSchema = z.enum(["high", "medium", "low"]);
export const planningEscalationPolicySchema = z.enum(["none", "enhanced_ai", "review_queue"]);
export const scenePrioritySchema = z.enum(["hero", "support", "ambient", "skip"]);
export const sceneDensitySchema = z.enum(["minimal", "balanced", "dense"]);
export const copyCompressionModeSchema = z.enum(["headline", "labelled", "bullet", "contrast", "cta"]);
export const visualRoleSchema = z.enum(["hero_scene", "support_overlay", "micro_emphasis", "transition_scene", "none"]);
export const holdStrategySchema = z.enum(["readable_hold", "carry_with_microbeats", "quick_punctuate", "transition_bridge"]);
export const semanticSlotRoleSchema = z.enum([
  "headline",
  "hero_number",
  "step_index",
  "step_label",
  "wrong_phrase",
  "correct_phrase",
  "command_hotkey",
  "keyword_accent",
  "supporting_context",
  "cta_phrase",
  "comparison_left",
  "comparison_right",
  "quote_pull"
]);
export const semanticSlotStyleSchema = z.enum(["accent", "primary", "muted", "success", "danger", "chip"]);
export const supportVisualKindSchema = z.enum([
  "cursor",
  "mouse",
  "keyboard",
  "hotkey_keys",
  "warning_mark",
  "number_badge",
  "checkmark",
  "timeline_tick",
  "chart_pulse"
]);
export const layerActionTypeSchema = z.enum([
  "show_layer",
  "hide_layer",
  "highlight_slot",
  "strike_slot",
  "swap_to_correct",
  "grow_number",
  "reveal_step",
  "show_hotkey",
  "pop_support_visual",
  "camera_push"
]);
export const sceneLayerKindSchema = z.enum([
  "speaker",
  "title",
  "subtitle",
  "number",
  "checklist",
  "comparison",
  "chart",
  "quote",
  "cta",
  "transition",
  "supporting_text"
]);

export const microBeatTypeSchema = z.enum([
  "number_emphasis",
  "keyword_highlight",
  "chart_tick",
  "label_reveal",
  "checklist_row",
  "strike_through",
  "subtitle_emphasis",
  "panel_state_change",
  "camera_push",
  "icon_pop",
  "background_shift"
]);

export const sceneLayerPlanSchema = z.object({
  id: z.string().min(1),
  kind: sceneLayerKindSchema,
  emphasis: z.enum(["support", "primary", "dominant"]).optional(),
  enabled: z.boolean(),
  payload: z.record(z.string(), z.unknown())
});

export const sceneMicroBeatSchema = z.object({
  id: z.string().min(1),
  type: microBeatTypeSchema,
  start: z.number().min(0),
  end: z.number().min(0),
  anchorText: z.string().optional(),
  anchorWordRange: z.object({
    startIndex: z.number().int().min(0),
    endIndex: z.number().int().min(0)
  }).optional(),
  payload: z.record(z.string(), z.unknown()).optional()
}).refine((value) => value.end >= value.start, {
  message: "Micro-beat end must be >= start."
});

export const semanticBlockSchema = z.object({
  id: z.string().min(1),
  type: semanticBlockTypeSchema,
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string(),
  summary: z.string(),
  words: z.array(z.object({
    word: z.string(),
    start: z.number().min(0),
    end: z.number().min(0),
    speaker: z.string().optional(),
    confidence: z.number().optional()
  })),
  transcriptWordRange: z.object({
    startIndex: z.number().int().min(0),
    endIndex: z.number().int().min(0)
  }),
  wordCount: z.number().int().min(0),
  contextBefore: z.string().optional(),
  contextAfter: z.string().optional()
}).refine((value) => value.end >= value.start, {
  message: "Semantic block end must be >= start."
});

export const planningConfidenceSchema = z.object({
  level: planningConfidenceLevelSchema,
  score: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  escalationPolicy: planningEscalationPolicySchema
});

export const screenCopyPayloadSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  text: z.string().optional(),
  left: z.string().optional(),
  right: z.string().optional(),
  items: z.array(z.string()).optional(),
  label: z.string().optional(),
  cta: z.string().optional(),
  value: z.string().optional(),
  caption: z.string().optional(),
  falseText: z.string().optional(),
  trueText: z.string().optional(),
  quote: z.string().optional(),
  center: z.string().optional(),
  slots: z.array(z.object({
    id: z.string().min(1),
    role: semanticSlotRoleSchema,
    text: z.string(),
    shortText: z.string().optional(),
    style: semanticSlotStyleSchema,
    start: z.number().min(0),
    end: z.number().min(0),
    wordRange: z.object({
      startIndex: z.number().int().min(0),
      endIndex: z.number().int().min(0)
    }).optional()
  }).refine((value) => value.end >= value.start, {
    message: "Semantic slot end must be >= start."
  })).optional(),
  supportVisuals: z.array(z.object({
    id: z.string().min(1),
    kind: supportVisualKindSchema,
    start: z.number().min(0),
    end: z.number().min(0),
    label: z.string().optional(),
    anchorSlotId: z.string().optional()
  }).refine((value) => value.end >= value.start, {
    message: "Support visual end must be >= start."
  })).optional(),
  layerActions: z.array(z.object({
    id: z.string().min(1),
    type: layerActionTypeSchema,
    start: z.number().min(0),
    end: z.number().min(0),
    targetLayerId: z.string().optional(),
    targetSlotId: z.string().optional(),
    supportVisualId: z.string().optional(),
    payload: z.record(z.string(), z.unknown()).optional()
  }).refine((value) => value.end >= value.start, {
    message: "Layer action end must be >= start."
  })).optional()
});

export const directorPlanBlockSchema = z.object({
  id: z.string().min(1),
  blockId: z.string().min(1),
  blockType: semanticBlockTypeSchema,
  sceneCategory: sceneCategorySchema,
  recipeId: sceneRecipeIdSchema,
  variantId: z.string().optional(),
  speakerMode: speakerModeSchema,
  intensity: sceneIntensitySchema,
  scenePriority: scenePrioritySchema,
  sceneDensity: sceneDensitySchema,
  visualRole: visualRoleSchema,
  holdStrategy: holdStrategySchema,
  transitionIn: sceneTransitionSchema,
  transitionOut: sceneTransitionSchema,
  start: z.number().min(0),
  end: z.number().min(0),
  rationale: z.string().optional(),
  fallbackRecipeId: sceneRecipeIdSchema.optional(),
  safeMode: z.boolean().optional(),
  disabled: z.boolean().optional(),
  allowedRecipeIds: z.array(sceneRecipeIdSchema).optional(),
  recommendedRecipeId: sceneRecipeIdSchema.optional(),
  planningConfidence: planningConfidenceSchema
}).refine((value) => value.end >= value.start, {
  message: "Director plan block end must be >= start."
});

export const directorPlanSchema = z.object({
  version: z.string().min(1),
  templateId: z.string().optional(),
  templateName: z.string().optional(),
  styleProfileId: z.string().min(1),
  planner: z.enum(["deterministic", "ai"]),
  semanticBlocks: z.array(semanticBlockSchema),
  blocks: z.array(directorPlanBlockSchema),
  diagnostics: z.array(z.string()).optional()
});

export const screenCopyBlockSchema = z.object({
  id: z.string().min(1),
  blockId: z.string().min(1),
  recipeId: sceneRecipeIdSchema,
  copyCompressionMode: copyCompressionModeSchema,
  payload: screenCopyPayloadSchema,
  editableFields: z.array(z.enum([
    "title",
    "subtitle",
    "text",
    "left",
    "right",
    "items",
    "label",
    "cta",
    "value",
    "caption",
    "falseText",
    "trueText",
    "quote",
    "center",
    "slots",
    "supportVisuals",
    "layerActions"
  ])),
  planningConfidence: planningConfidenceSchema,
  rationale: z.string().optional()
});

export const screenCopyPlanSchema = z.object({
  version: z.string().min(1),
  templateId: z.string().optional(),
  styleProfileId: z.string().min(1),
  planner: z.enum(["deterministic", "ai"]),
  blocks: z.array(screenCopyBlockSchema),
  diagnostics: z.array(z.string()).optional()
});

export const scenePlanBlockSchema = z.object({
  id: z.string().min(1),
  blockId: z.string().min(1),
  blockType: semanticBlockTypeSchema,
  sceneCategory: sceneCategorySchema,
  recipeId: sceneRecipeIdSchema,
  variantId: z.string().optional(),
  speakerMode: speakerModeSchema,
  layerPlan: z.array(sceneLayerPlanSchema),
  microBeats: z.array(sceneMicroBeatSchema),
  intensity: sceneIntensitySchema,
  transitionIn: sceneTransitionSchema,
  transitionOut: sceneTransitionSchema,
  start: z.number().min(0),
  end: z.number().min(0),
  rationale: z.string().optional(),
  fallbackRecipeId: sceneRecipeIdSchema.optional(),
  safeMode: z.boolean().optional(),
  allowedRecipeIds: z.array(sceneRecipeIdSchema).optional(),
  recommendedRecipeId: sceneRecipeIdSchema.optional(),
  planningConfidence: planningConfidenceSchema.optional(),
  scenePriority: scenePrioritySchema.optional(),
  sceneDensity: sceneDensitySchema.optional(),
  visualRole: visualRoleSchema.optional(),
  holdStrategy: holdStrategySchema.optional()
}).refine((value) => value.end >= value.start, {
  message: "Scene plan block end must be >= start."
});

export const scenePlanSchema = z.object({
  version: z.string().min(1),
  templateId: z.string().optional(),
  templateName: z.string().optional(),
  styleProfileId: z.string().min(1),
  planner: z.enum(["deterministic", "ai"]),
  semanticBlocks: z.array(semanticBlockSchema),
  blocks: z.array(scenePlanBlockSchema),
  diagnostics: z.array(z.string()).optional()
});
