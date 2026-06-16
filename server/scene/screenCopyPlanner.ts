import type {
  ContentPlan,
  DirectorPlan,
  PlanningConfidence,
  SceneRecipeId,
  ScreenCopyBlock,
  ScreenCopyPayload,
  ScreenCopyPlan,
  SemanticBlock
} from "@/lib/types";
import { getAiConfigForTask } from "@/lib/config";
import { callChatCompletion } from "@/server/ai/openRouterClient";
import { buildScreenCopyPlannerSystemPrompt, buildScreenCopyPlannerUserPrompt } from "@/server/ai/screenCopyPlannerPrompts";
import { buildSemanticScreenPayload } from "@/server/scene/semanticSlotPlanner";
import { recordAiUsage } from "@/server/ai/usage";
import { screenCopyPlanSchema } from "@/server/scene/scenePlanSchema";

export const SCREEN_COPY_PLAN_VERSION = "v2";

interface BuildScreenCopyPlanInput {
  semanticBlocks: SemanticBlock[];
  directorPlan: DirectorPlan;
  contentPlan: ContentPlan;
}

export async function buildScreenCopyPlan(
  input: BuildScreenCopyPlanInput,
  projectId?: string,
  log?: (message: string) => Promise<void> | void
): Promise<ScreenCopyPlan> {
  const fallbackPlan = buildDeterministicScreenCopyPlan(input);
  const config = getAiConfigForTask("visual_planner");
  if (!config.apiKey) {
    await log?.("Screen copy planner: API key is not configured; using deterministic copy.");
    return fallbackPlan;
  }

  const flaggedBlocks = input.directorPlan.blocks.filter((block) => block.planningConfidence.level === "low");
  if (flaggedBlocks.length === 0) {
    return fallbackPlan;
  }

  try {
    const result = await callChatCompletion(
      config,
      buildScreenCopyPlannerSystemPrompt(),
      buildScreenCopyPlannerUserPrompt(input.semanticBlocks, input.directorPlan, input.contentPlan)
    );
    await recordAiUsage({ projectId, source: "hyperframes", phase: "screen_copy_planner", result });
    const parsed = parseAiScreenCopyPlan(result.content, input, fallbackPlan);
    await log?.(`Screen copy planner refreshed ${flaggedBlocks.length} low-confidence blocks.`);
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await log?.(`Screen copy planner failed; using deterministic copy. Original error: ${message}`);
    return fallbackPlan;
  }
}

export function buildDeterministicScreenCopyPlan(input: BuildScreenCopyPlanInput): ScreenCopyPlan {
  const blocks = input.directorPlan.blocks.map((directorBlock, index) => {
    const semanticBlock = input.semanticBlocks.find((entry) => entry.id === directorBlock.blockId);
    if (!semanticBlock) {
      throw new Error(`Missing semantic block ${directorBlock.blockId} for screen copy planner.`);
    }
    return buildScreenCopyBlock(semanticBlock, directorBlock.recipeId, directorBlock.planningConfidence, index === 0 ? input.contentPlan.hook : undefined);
  });

  const plan: ScreenCopyPlan = {
    version: SCREEN_COPY_PLAN_VERSION,
    templateId: input.directorPlan.templateId,
    styleProfileId: input.directorPlan.styleProfileId,
    planner: "deterministic",
    blocks,
    diagnostics: [
      `Built ${blocks.length} screen-copy blocks.`,
      "Deterministic screen-copy compression enabled."
    ]
  };
  screenCopyPlanSchema.parse(plan);
  return plan;
}

export function buildScreenCopyBlock(
  block: SemanticBlock,
  recipeId: SceneRecipeId,
  directorConfidence: PlanningConfidence,
  preferredTitle?: string
): ScreenCopyBlock {
  const { payload, confidence } = buildSemanticScreenPayload(block, recipeId, directorConfidence, preferredTitle);
  const editableFields = Object.keys(payload).filter((key) => payload[key as keyof ScreenCopyPayload] !== undefined) as Array<keyof ScreenCopyPayload>;
  return {
    id: `copy-${block.id}`,
    blockId: block.id,
    recipeId,
    copyCompressionMode: chooseCompressionMode(recipeId),
    payload,
    editableFields: editableFields.length > 0 ? editableFields : ["title"],
    planningConfidence: confidence,
    rationale: `Semantic slot payload for ${recipeId}.`
  };
}

function chooseCompressionMode(recipeId: SceneRecipeId): ScreenCopyBlock["copyCompressionMode"] {
  if (recipeId === "checklist_reveal" || recipeId === "timeline_year_callout" || recipeId === "step_number_callout" || recipeId === "list_progression") return "bullet";
  if (recipeId === "comparison_split" || recipeId === "myth_vs_truth" || recipeId === "warning_strike_fix" || recipeId === "before_after_phrase_swap") return "contrast";
  if (recipeId === "cta_finish") return "cta";
  if (recipeId === "big_number_grow" || recipeId === "big_number_plus_text_plate" || recipeId === "headline_with_accent_number" || recipeId === "hotkey_command_tip") return "labelled";
  return "headline";
}

function parseAiScreenCopyPlan(raw: string, input: BuildScreenCopyPlanInput, fallbackPlan: ScreenCopyPlan): ScreenCopyPlan {
  const parsed = parseJsonObject(raw);
  const aiBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
  const mergedBlocks = fallbackPlan.blocks.map((fallbackBlock) => {
    const directorBlock = input.directorPlan.blocks.find((entry) => entry.blockId === fallbackBlock.blockId);
    const candidate = aiBlocks.find((item) => item && typeof item === "object" && (item as Record<string, unknown>).blockId === fallbackBlock.blockId);
    if (!candidate || typeof candidate !== "object" || !directorBlock || directorBlock.planningConfidence.level !== "low") return fallbackBlock;

    const item = candidate as Record<string, unknown>;
    const payload = sanitizePayload(item.payload);
    const mergedPayload = Object.keys(payload).length > 0 ? payload : fallbackBlock.payload;
    return {
      ...fallbackBlock,
      copyCompressionMode: parseCompressionMode(item.copyCompressionMode, fallbackBlock.copyCompressionMode),
      payload: mergedPayload,
      editableFields: (Object.keys(mergedPayload) as Array<keyof ScreenCopyPayload>),
      planningConfidence: buildSemanticScreenPayload(
        input.semanticBlocks.find((entry) => entry.id === fallbackBlock.blockId) ?? input.semanticBlocks[0]!,
        fallbackBlock.recipeId,
        directorBlock.planningConfidence
      ).confidence,
      rationale: typeof item.rationale === "string" ? item.rationale : fallbackBlock.rationale
    };
  });

  const plan = {
    ...fallbackPlan,
    planner: "ai" as const,
    blocks: mergedBlocks
  };
  screenCopyPlanSchema.parse(plan);
  return plan;
}

function sanitizePayload(payload: unknown): ScreenCopyPayload {
  if (!payload || typeof payload !== "object") return {};
  const record = payload as Record<string, unknown>;
  return {
    title: readString(record.title),
    subtitle: readString(record.subtitle),
    text: readString(record.text),
    left: readString(record.left),
    right: readString(record.right),
    items: Array.isArray(record.items) ? record.items.map(String).filter(Boolean).slice(0, 4) : undefined,
    label: readString(record.label),
    cta: readString(record.cta),
    value: readString(record.value),
    caption: readString(record.caption),
    falseText: readString(record.falseText),
    trueText: readString(record.trueText),
    quote: readString(record.quote),
    center: readString(record.center),
    slots: Array.isArray(record.slots)
      ? record.slots
          .filter((item) => item && typeof item === "object")
          .map((item, index) => {
            const slot = item as Record<string, unknown>;
            return {
              id: readString(slot.id) ?? `ai-slot-${index + 1}`,
              role: readString(slot.role) as NonNullable<ScreenCopyPayload["slots"]>[number]["role"],
              text: readString(slot.text) ?? "",
              shortText: readString(slot.shortText),
              style: (readString(slot.style) as NonNullable<ScreenCopyPayload["slots"]>[number]["style"]) ?? "primary",
              start: typeof slot.start === "number" ? slot.start : 0,
              end: typeof slot.end === "number" ? slot.end : 0
            };
          })
          .filter((slot) => slot.text && slot.end >= slot.start)
      : undefined,
    supportVisuals: Array.isArray(record.supportVisuals)
      ? record.supportVisuals
          .filter((item) => item && typeof item === "object")
          .map((item, index) => {
            const visual = item as Record<string, unknown>;
            return {
              id: readString(visual.id) ?? `ai-visual-${index + 1}`,
              kind: (readString(visual.kind) as NonNullable<ScreenCopyPayload["supportVisuals"]>[number]["kind"]) ?? "cursor",
              start: typeof visual.start === "number" ? visual.start : 0,
              end: typeof visual.end === "number" ? visual.end : 0,
              label: readString(visual.label),
              anchorSlotId: readString(visual.anchorSlotId)
            };
          })
          .filter((visual) => visual.end >= visual.start)
      : undefined,
    layerActions: Array.isArray(record.layerActions)
      ? record.layerActions
          .filter((item) => item && typeof item === "object")
          .map((item, index) => {
            const action = item as Record<string, unknown>;
            return {
              id: readString(action.id) ?? `ai-action-${index + 1}`,
              type: (readString(action.type) as NonNullable<ScreenCopyPayload["layerActions"]>[number]["type"]) ?? "show_layer",
              start: typeof action.start === "number" ? action.start : 0,
              end: typeof action.end === "number" ? action.end : 0,
              targetSlotId: readString(action.targetSlotId),
              supportVisualId: readString(action.supportVisualId)
            };
          })
          .filter((action) => action.end >= action.start)
      : undefined
  };
}

function parseCompressionMode(value: unknown, fallback: ScreenCopyBlock["copyCompressionMode"]) {
  return value === "headline" || value === "labelled" || value === "bullet" || value === "contrast" || value === "cta"
    ? value
    : fallback;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseJsonObject(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("Screen copy planner returned invalid JSON.");
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}
