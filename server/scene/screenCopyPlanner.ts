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
import { recordAiUsage } from "@/server/ai/usage";
import { screenCopyPlanSchema } from "@/server/scene/scenePlanSchema";

export const SCREEN_COPY_PLAN_VERSION = "v1";
const NUMBER_RE = /(\d+[.,]?\d*)\s?(%|к|k|тыс|млн|x|раз|₽|\$)?/iu;

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
  const payload = buildPayloadForRecipe(block, recipeId, preferredTitle);
  const editableFields = Object.keys(payload).filter((key) => payload[key as keyof ScreenCopyPayload] !== undefined) as Array<keyof ScreenCopyPayload>;
  return {
    id: `copy-${block.id}`,
    blockId: block.id,
    recipeId,
    copyCompressionMode: chooseCompressionMode(recipeId),
    payload,
    editableFields: editableFields.length > 0 ? editableFields : ["title"],
    planningConfidence: mergeCopyConfidence(directorConfidence, payload),
    rationale: `Deterministic copy payload for ${recipeId}.`
  };
}

function buildPayloadForRecipe(block: SemanticBlock, recipeId: SceneRecipeId, preferredTitle?: string): ScreenCopyPayload {
  const headline = compressHeadline(preferredTitle && block.type === "hook" ? preferredTitle : block.summary);
  const detail = compressDetail(block.text, 68);
  const items = splitItems(block.text);
  const pair = buildContrastPair(block.text);
  const number = extractFirstNumber(block.text);

  switch (recipeId) {
    case "comparison_split":
      return { left: pair.left, right: pair.right, caption: headline };
    case "myth_vs_truth":
      return { falseText: pair.left, trueText: pair.right, label: headline };
    case "checklist_reveal":
      return { title: headline, items: items.slice(0, 4) };
    case "timeline_year_callout":
      return { title: headline, items: items.slice(0, 4) };
    case "trust_diagram":
      return { title: headline, center: number ?? "TRUST", left: pair.left, right: pair.right, caption: detail };
    case "quote_emphasis":
      return { quote: compressDetail(block.text, 44), label: headline };
    case "cta_finish":
      return { text: headline, cta: compressHeadline(block.text), label: "CTA" };
    case "speaker_right_panel_left_infographic":
      return { title: headline, label: detail, value: number ?? "01", items: items.slice(0, 3) };
    case "speaker_lower_half_top_visual":
    case "voiceover_full_graphic":
      return { title: headline, subtitle: detail, items: items.slice(0, 4) };
    case "big_number_grow":
    case "big_number_plus_text_plate":
      return { value: number ?? "1", label: headline, text: detail };
    case "definition_card":
      return { title: headline, subtitle: detail, items: items.slice(0, 3) };
    case "camera_punch_in":
      return { title: headline, text: compressDetail(block.text, 36) };
    case "clean_section_transition":
      return { title: headline };
    default:
      return { title: headline, subtitle: detail };
  }
}

function chooseCompressionMode(recipeId: SceneRecipeId): ScreenCopyBlock["copyCompressionMode"] {
  if (recipeId === "checklist_reveal" || recipeId === "timeline_year_callout") return "bullet";
  if (recipeId === "comparison_split" || recipeId === "myth_vs_truth") return "contrast";
  if (recipeId === "cta_finish") return "cta";
  if (recipeId === "big_number_grow" || recipeId === "big_number_plus_text_plate") return "labelled";
  return "headline";
}

function mergeCopyConfidence(directorConfidence: PlanningConfidence, payload: ScreenCopyPayload): PlanningConfidence {
  const reasons = [...directorConfidence.reasons];
  let score = directorConfidence.score;

  if (payload.items && payload.items.some((item) => item.length > 34)) {
    reasons.push("dense list copy");
    score -= 0.08;
  }
  if (payload.title && payload.title.length > 32) {
    reasons.push("title too long");
    score -= 0.08;
  }
  if (!payload.title && !payload.quote && !payload.value && !payload.left) {
    reasons.push("weak slot fill");
    score -= 0.12;
  }

  const normalized = Math.max(0.2, Number(score.toFixed(2)));
  return {
    level: normalized >= 0.8 ? "high" : normalized >= 0.58 ? "medium" : "low",
    score: normalized,
    reasons,
    escalationPolicy: normalized < 0.58 ? "enhanced_ai" : directorConfidence.escalationPolicy
  };
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
      planningConfidence: mergeCopyConfidence(directorBlock.planningConfidence, mergedPayload),
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
    center: readString(record.center)
  };
}

function parseCompressionMode(value: unknown, fallback: ScreenCopyBlock["copyCompressionMode"]) {
  return value === "headline" || value === "labelled" || value === "bullet" || value === "contrast" || value === "cta"
    ? value
    : fallback;
}

function compressHeadline(text: string) {
  return trimSentence(text)
    .split(/\s+/)
    .slice(0, 5)
    .join(" ")
    .slice(0, 32)
    .trim();
}

function compressDetail(text: string, maxChars: number) {
  const cleaned = trimSentence(text);
  if (cleaned.length <= maxChars) return cleaned;
  const words = cleaned.split(/\s+/);
  let result = "";
  for (const word of words) {
    const next = result ? `${result} ${word}` : word;
    if (next.length > maxChars) break;
    result = next;
  }
  return result || cleaned.slice(0, maxChars).trim();
}

function splitItems(text: string) {
  const raw = text
    .split(/[,:;]|(?:\s+-\s+)|(?:\.\s+)/)
    .map((item) => trimSentence(item))
    .filter((item) => item.length >= 3);
  return raw.length >= 2 ? raw.slice(0, 4).map((item) => compressDetail(item, 28)) : [compressDetail(text, 28)];
}

function buildContrastPair(text: string) {
  const separators = [" vs ", " VS ", " versus ", " против ", " вместо ", " до ", " after ", " before ", " после "];
  for (const separator of separators) {
    if (!text.includes(separator)) continue;
    const [left, right] = text.split(separator, 2);
    return {
      left: compressDetail(left, 24),
      right: compressDetail(right, 24)
    };
  }
  const items = splitItems(text);
  return {
    left: items[0] ?? "До",
    right: items[1] ?? items[0] ?? "После"
  };
}

function extractFirstNumber(text: string) {
  return text.match(NUMBER_RE)?.[0]?.trim();
}

function trimSentence(text: string) {
  return text.replace(/\s+/g, " ").replace(/^[-:;,.\s]+|[-:;,.\s]+$/g, "").trim();
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
