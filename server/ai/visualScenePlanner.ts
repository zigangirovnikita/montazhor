import type {
  ContentPlan,
  EditDecisionList,
  StylePreset,
  SubtitleDraft,
  TranscriptJson,
  TranscriptWord,
  VisualScene,
  VisualSceneLayoutMode,
  VisualScenePlan,
  VisualSceneType
} from "@/lib/types";
import { getAiConfigForTask } from "@/lib/config";
import { callChatCompletion } from "@/server/ai/openRouterClient";
import { recordAiUsage } from "@/server/ai/usage";
import { cleanText, roundTime } from "@/server/ai/visualPayload";
import { scenePresetById, scenePresetForType, visualScenePresets } from "@/server/hyperframes/sceneRegistry";

interface ScenePlannerInput {
  transcript?: TranscriptJson;
  edl?: EditDecisionList;
  subtitles: SubtitleDraft[];
  contentPlan: ContentPlan;
  stylePreset: StylePreset;
  duration: number;
}

interface IdeaBlock {
  id: string;
  start: number;
  end: number;
  text: string;
  words: TranscriptWord[];
}

const NUMBER_RE = /(\d+[.,]?\d*)\s?(%|к|k|тыс|млн|x|раз|₽|\$)?/gi;
const HAS_NUMBER_RE = /(\d+[.,]?\d*)\s?(%|к|k|тыс|млн|x|раз|₽|\$)?/i;
const WARNING_RE = /\b(ошибка|миф|нельзя|опасно|стоп|проблема|wrong|mistake|myth|premature|risk)\b/i;
const LIST_RE = /\b(первое|второе|третье|шаг|пункт|причина|когда|как|сколько|when|how|charge|first|second|third)\b/i;
const TRUST_RE = /\b(довер|trust|источник|source|earned|inherited|relationship|аудит|audit)\b/i;
const CTA_RE = /\b(подпиш|сохрани|забирай|переходи|смотри|читай|subscribe|follow|save|download|join)\b/i;
const QUOTE_RE = /["«»]/;
const COMPARE_RE = /\b(против|вместо|или|versus|vs|but|instead|before|after|до|после)\b/i;
const TIMELINE_RE = /\b(сначала|потом|затем|после этого|first|then|next|finally|step)\b/i;

export function buildVisualScenePlan(input: ScenePlannerInput): VisualScenePlan {
  const blocks = buildIdeaBlocks(input.subtitles, input.duration);
  const selectedBlocks = selectSceneBlocks(blocks);
  const scenes = selectedBlocks.map((block, index) => sceneForBlock(block, index, input.contentPlan));

  return {
    styleProfileId: input.stylePreset,
    scenes,
    planner: "deterministic",
    diagnostics: [
      `Built ${blocks.length} idea blocks from cleaned subtitles.`,
      `Selected ${scenes.length} cinematic scenes.`
    ]
  };
}

export async function buildVisualScenePlanWithAi(
  input: ScenePlannerInput,
  projectId?: string,
  log?: (message: string) => Promise<void> | void
): Promise<VisualScenePlan> {
  const deterministic = buildVisualScenePlan(input);
  const blocks = buildIdeaBlocks(input.subtitles, input.duration);
  const config = getAiConfigForTask("visual_planner");
  if (!config.apiKey) {
    await log?.("AI cinematic scene planner skipped: API key is not configured; using deterministic scene planner.");
    return deterministic;
  }

  await log?.(`AI cinematic scene planner: directing scenes using ${config.provider}/${config.model}...`);
  const result = await callChatCompletion(config, buildScenePlannerSystemPrompt(), buildScenePlannerUserPrompt(input, blocks, deterministic));
  await recordAiUsage({ projectId, source: "hyperframes", phase: "visual_scene_planner", result });
  const aiPlan = parseAiScenePlan(result.content, input, blocks);
  if (aiPlan.scenes.length === 0) {
    throw new Error("AI cinematic scene planner returned no usable scenes.");
  }
  await log?.(`AI cinematic scene planner selected ${aiPlan.scenes.length} directed scenes.`);
  return aiPlan;
}

function buildIdeaBlocks(subtitles: SubtitleDraft[], duration: number): IdeaBlock[] {
  const words = uniqueWords(subtitles.flatMap((subtitle) => subtitle.words)).filter((word) => word.end > word.start);
  const blocks: IdeaBlock[] = [];
  let index = 0;

  while (index < words.length) {
    const start = index;
    let end = index + 1;

    while (end < words.length) {
      const first = words[start]!;
      const previous = words[end - 1]!;
      const current = words[end]!;
      const blockDuration = current.end - first.start;
      const gap = current.start - previous.end;
      const count = end - start;

      if (blockDuration >= 3.2 && /[.!?]$/.test(previous.word)) break;
      if (blockDuration >= 5.8 && gap > 0.2) break;
      if (blockDuration >= 7.8 || count >= 26) break;
      end += 1;
    }

    const blockWords = words.slice(start, end);
    const text = cleanText(blockWords.map((word) => word.word).join(" "));
    if (text) {
      blocks.push({
        id: `idea-${blocks.length}`,
        start: roundTime(Math.max(0, blockWords[0]!.start)),
        end: roundTime(Math.min(duration, blockWords.at(-1)!.end)),
        text,
        words: blockWords
      });
    }
    index = Math.max(end, index + 1);
  }

  return mergeShortBlocks(blocks, duration);
}

function selectSceneBlocks(blocks: IdeaBlock[]) {
  if (blocks.length <= 8) return blocks.filter((block, index) => index === 0 || shouldRenderBlock(block));
  const important = blocks.filter((block, index) => index === 0 || scoreBlock(block.text) >= 2);
  const targetCount = Math.min(12, Math.max(5, Math.ceil(blocks.length * 0.58)));
  const selected = important.length >= 4 ? important : blocks.filter((_, index) => index % 2 === 0);
  return selected.slice(0, targetCount);
}

function sceneForBlock(block: IdeaBlock, index: number, contentPlan: ContentPlan): VisualScene {
  const sceneType = sceneTypeForBlock(block, index);
  const preset = scenePresetForType(sceneType);
  const layoutMode = layoutModeForScene(sceneType, index);
  const payload = payloadForScene(sceneType, block, index, contentPlan);

  return {
    id: `scene-${String(index + 1).padStart(3, "0")}`,
    start: block.start,
    duration: roundTime(Math.max(2.6, block.end - block.start + 0.3)),
    sceneType,
    presetId: preset.id,
    layoutMode,
    sourceText: block.text,
    payload,
    safeRegionPolicy: layoutMode === "pip" || layoutMode === "full_frame" ? "pip_safe" : "avoid_speaker",
    transitionIn: index === 0 ? "zoom" : "slide",
    transitionOut: "fade"
  };
}

function sceneTypeForBlock(block: IdeaBlock, index: number): VisualSceneType {
  const text = block.text;
  const numbers = [...text.matchAll(NUMBER_RE)];
  if (index === 0) return "lesson_title";
  if (CTA_RE.test(text)) return "cta_plate";
  if (QUOTE_RE.test(text)) return "quote_focus";
  if (TIMELINE_RE.test(text)) return "timeline_steps";
  if (COMPARE_RE.test(text)) return "compare_split";
  if (WARNING_RE.test(text)) return "myth_strike";
  if (numbers.length >= 2) return "ratio_stack";
  if (numbers.length === 1) return "stat_hud";
  if (TRUST_RE.test(text)) return "trust_map";
  if (LIST_RE.test(text) || splitItems(text).length >= 3) return "three_cards";
  if (index % 4 === 2) return "pip_slide";
  return "lesson_title";
}

function layoutModeForScene(sceneType: VisualSceneType, index: number): VisualSceneLayoutMode {
  if (sceneType === "trust_map" || sceneType === "three_cards" || sceneType === "warning_dialogue") return "pip";
  if (sceneType === "pip_slide") return "pip";
  if (sceneType === "timeline_steps" || sceneType === "cta_plate") return "full_frame";
  if (sceneType === "compare_split") return "split";
  if (index > 0 && index % 5 === 0) return "pip";
  return "overlay";
}

function payloadForScene(sceneType: VisualSceneType, block: IdeaBlock, index: number, contentPlan: ContentPlan) {
  const text = block.text;
  const items = splitItems(text);
  const numbers = [...text.matchAll(NUMBER_RE)].map((match) => cleanText(match[0]));
  const title = titleFromText(index === 0 && contentPlan.hook ? contentPlan.hook : text, 5);

  if (sceneType === "lesson_title") {
    return { eyebrow: index === 0 ? "LESSON · 01" : `KEY · ${String(index + 1).padStart(2, "0")}`, title, subtitle: firstSentence(text), sourceText: text };
  }
  if (sceneType === "ratio_stack") {
    return {
      eyebrow: "SYSTEM RATIO",
      title: titleFromText(text, 4),
      items: ratioItems(numbers, text),
      sourceText: text
    };
  }
  if (sceneType === "myth_strike") {
    return {
      eyebrow: `MYTH · ${String(index).padStart(2, "0")}`,
      falseText: titleFromText(items[0] ?? text, 2),
      trueText: firstSentence(items[1] ?? text),
      sourceText: text
    };
  }
  if (sceneType === "stat_hud") {
    const value = numbers[0] ?? "01";
    return { eyebrow: `0${Math.min(index + 1, 9)} · DETERMINISTIC`, value, label: extractNumberContext(text, value), caption: firstSentence(text), sourceText: text };
  }
  if (sceneType === "trust_map") {
    return {
      eyebrow: "DEFINITION",
      title: titleFromText(text, 5),
      center: keywordFromText(text, "TRUST"),
      left: items[0] ?? "Earned",
      right: items[1] ?? "Inherited",
      caption: firstSentence(text),
      sourceText: text
    };
  }
  if (sceneType === "three_cards") {
    return {
      eyebrow: "BY THE END → YOU'LL KNOW...",
      items: normalizeThreeItems(items, text),
      sourceText: text
    };
  }
  if (sceneType === "warning_dialogue") {
    return { eyebrow: "NO TRUST YET?", label: "PREMATURE", wrong: items[0] ?? text, right: items[1] ?? "Better next move", sourceText: text };
  }
  if (sceneType === "compare_split") {
    return { eyebrow: "COMPARE", left: items[0] ?? firstSentence(text), right: items[1] ?? "Better option", caption: firstSentence(text), sourceText: text };
  }
  if (sceneType === "timeline_steps") {
    return { eyebrow: "SEQUENCE", title, items: normalizeThreeItems(items, text), sourceText: text };
  }
  if (sceneType === "quote_focus") {
    return { eyebrow: "QUOTE", quote: firstSentence(text).replace(/[«»"]/g, ""), sourceText: text };
  }
  if (sceneType === "cta_plate") {
    return { eyebrow: "NEXT STEP", text: firstSentence(text), label: "ACTION", sourceText: text };
  }
  return { eyebrow: "LESSON", title, subtitle: firstSentence(text), sourceText: text };
}

function shouldRenderBlock(block: IdeaBlock) {
  const words = block.text.split(/\s+/).filter(Boolean);
  return words.length >= 4 || scoreBlock(block.text) > 0;
}

function mergeShortBlocks(blocks: IdeaBlock[], duration: number) {
  const result: IdeaBlock[] = [];
  for (const block of blocks) {
    const previous = result.at(-1);
    if (previous && block.end - previous.start < 3.4 && block.start - previous.end < 0.35) {
      previous.end = Math.min(duration, block.end);
      previous.words.push(...block.words);
      previous.text = cleanText(previous.words.map((word) => word.word).join(" "));
      continue;
    }
    result.push({ ...block, id: `idea-${result.length}` });
  }
  return result;
}

function uniqueWords(words: TranscriptWord[]) {
  const result: TranscriptWord[] = [];
  const seen = new Set<string>();
  for (const word of words.sort((a, b) => a.start - b.start)) {
    const key = `${word.start.toFixed(3)}:${word.end.toFixed(3)}:${word.word}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(word);
  }
  return result;
}

function scoreBlock(text: string) {
  return Number(HAS_NUMBER_RE.test(text)) + Number(WARNING_RE.test(text)) + Number(LIST_RE.test(text)) + Number(TRUST_RE.test(text)) + Number(CTA_RE.test(text)) + Number(COMPARE_RE.test(text));
}

function splitItems(text: string) {
  return cleanText(text)
    .split(/(?<=[.!?])\s+|[,;:]\s+|\s+-\s+|\s(?:и|and)\s/gi)
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, 4);
}

function normalizeThreeItems(items: string[], fallback: string) {
  const source = items.length >= 3 ? items : cleanText(fallback).split(/\s+/).reduce<string[]>((acc, word, index) => {
    const bucket = Math.min(2, Math.floor(index / Math.max(1, Math.ceil(fallback.split(/\s+/).length / 3))));
    acc[bucket] = cleanText(`${acc[bucket] ?? ""} ${word}`);
    return acc;
  }, []);
  return source.slice(0, 3).map((item, index) => ({
    index: String(index + 1).padStart(2, "0"),
    title: titleFromText(item, 2),
    text: firstSentence(item)
  }));
}

function ratioItems(numbers: string[], text: string) {
  const labels = splitItems(text);
  const values = numbers.length ? numbers : ["60%", "30%", "10%"];
  return values.slice(0, 3).map((value, index) => ({
    value,
    label: labels[index] ? titleFromText(labels[index], 3) : ["DETERMINISTIC", "AI ASSISTED", "HUMAN"][index] ?? "SYSTEM"
  }));
}

function titleFromText(text: string, words: number) {
  return cleanText(text)
    .split(/\s+/)
    .slice(0, words)
    .join(" ")
    .replace(/[.!?]+$/g, "")
    .toUpperCase();
}

function firstSentence(text: string) {
  return cleanText(text.split(/(?<=[.!?])\s+/)[0] ?? text);
}

function keywordFromText(text: string, fallback: string) {
  return titleFromText(text.split(/\s+/).find((word) => word.length > 5) ?? fallback, 1);
}

function extractNumberContext(text: string, number: string) {
  const index = text.indexOf(number);
  if (index === -1) return firstSentence(text);
  const before = cleanText(text.slice(0, index)).split(/\s+/).slice(-2);
  const after = cleanText(text.slice(index + number.length)).split(/\s+/).slice(0, 3);
  return cleanText([...before, ...after].join(" ")) || firstSentence(text);
}

function buildScenePlannerSystemPrompt() {
  return [
    "You are a motion director for short talking-head educational videos.",
    "You direct scene-based HyperFrames compositions, not subtitle cards.",
    "Choose only from the provided scene registry. Never invent HTML, CSS, templates, effects, facts, numbers, or claims.",
    "You may skip weak blocks. Do not force a visual scene over filler or connective speech.",
    "Use the speaker's original words as source of truth.",
    "Return strict JSON only."
  ].join(" ");
}

function buildScenePlannerUserPrompt(input: ScenePlannerInput, blocks: IdeaBlock[], deterministic: VisualScenePlan) {
  return JSON.stringify({
    task: "Select cinematic scenes for this already-cleaned talking-head video.",
    output_schema: {
      scenes: [
        {
          sourceBlockId: "idea block id or omit when skip is true",
          skip: false,
          sceneType: visualScenePresets.map((preset) => preset.sceneType),
          presetId: "preset id from scene_registry matching sceneType",
          layoutMode: ["overlay", "full_frame", "pip", "split"],
          payload: "object using only text from the source block",
          safeRegionPolicy: ["avoid_speaker", "full_frame", "pip_safe"],
          transitionIn: ["fade", "slide", "zoom"],
          transitionOut: ["fade", "slide", "cut"]
        }
      ]
    },
    guardrails: [
      "Return 5-12 scenes for a 30-60 second video when there is enough material.",
      "Skip weak filler blocks instead of creating decorative noise.",
      "Do not change start/duration. Server will preserve source block timing.",
      "Do not invent facts, names, numbers, offers, or claims.",
      "For split/PIP/full_frame layouts, keep payload concise enough for one frame.",
      "Prefer different scene types across the video.",
      "Use cta_plate only for explicit calls to action.",
      "Use compare_split only when the source block contrasts two ideas.",
      "Use timeline_steps when the source block has a sequence.",
      "Use quote_focus for a strong quote or memorable phrase."
    ],
    video_duration: roundTime(input.duration),
    content_plan: input.contentPlan,
    transcript_context: input.transcript
      ? {
        language: input.transcript.language,
        provider: input.transcript.provider,
        segments: input.transcript.segments.length
      }
      : null,
    edl_context: input.edl
      ? {
        keptRanges: input.edl.keptRanges.length,
        removedRanges: input.edl.removedRanges.length
      }
      : null,
    scene_registry: visualScenePresets,
    deterministic_starting_point: deterministic.scenes.map((scene) => ({
      sourceBlockText: scene.sourceText,
      sceneType: scene.sceneType,
      presetId: scene.presetId,
      layoutMode: scene.layoutMode,
      payload: scene.payload
    })),
    idea_blocks: blocks.map((block) => ({
      id: block.id,
      start: roundTime(block.start),
      end: roundTime(block.end),
      text: block.text
    }))
  });
}

function parseAiScenePlan(raw: string, input: ScenePlannerInput, blocks: IdeaBlock[]): VisualScenePlan {
  const parsed = parseJsonObject(raw) as { scenes?: unknown[] };
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const scenes = Array.isArray(parsed.scenes)
    ? parsed.scenes
      .map((value, index) => parseAiScene(value, index, blockById, input.contentPlan))
      .filter((scene): scene is VisualScene => Boolean(scene))
      .slice(0, 12)
    : [];

  return {
    styleProfileId: input.stylePreset,
    scenes,
    planner: "ai",
    diagnostics: [`AI selected ${scenes.length} cinematic scenes from ${blocks.length} idea blocks.`]
  };
}

function parseAiScene(value: unknown, index: number, blockById: Map<string, IdeaBlock>, contentPlan: ContentPlan): VisualScene | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  if (item.skip === true) return undefined;
  if (typeof item.sourceBlockId !== "string") return undefined;
  const block = blockById.get(item.sourceBlockId);
  if (!block) return undefined;
  if (typeof item.sceneType !== "string" || typeof item.presetId !== "string") return undefined;
  const preset = scenePresetById(item.presetId);
  if (!preset || preset.sceneType !== item.sceneType) return undefined;
  const layoutMode = parseLayoutMode(item.layoutMode, preset.layoutModes[0] ?? "overlay");
  if (!preset.layoutModes.includes(layoutMode)) return undefined;

  const sceneType = item.sceneType as VisualSceneType;
  const payload = item.payload && typeof item.payload === "object" && !Array.isArray(item.payload)
    ? sanitizePayload(item.payload as Record<string, unknown>, block.text)
    : payloadForScene(sceneType, block, index, contentPlan);

  return {
    id: `scene-${String(index + 1).padStart(3, "0")}`,
    start: block.start,
    duration: roundTime(Math.max(2.6, block.end - block.start + 0.3)),
    sceneType,
    presetId: preset.id,
    layoutMode,
    sourceText: block.text,
    payload: { ...payload, sourceText: block.text },
    safeRegionPolicy: layoutMode === "overlay" ? "avoid_speaker" : layoutMode === "full_frame" ? "full_frame" : "pip_safe",
    transitionIn: parseTransitionIn(item.transitionIn),
    transitionOut: parseTransitionOut(item.transitionOut)
  };
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI cinematic scene planner returned non-JSON content.");
    return JSON.parse(match[0]) as Record<string, unknown>;
  }
}

function parseLayoutMode(value: unknown, fallback: VisualSceneLayoutMode): VisualSceneLayoutMode {
  return value === "full_frame" || value === "pip" || value === "split" || value === "overlay" ? value : fallback;
}

function parseTransitionIn(value: unknown): VisualScene["transitionIn"] {
  return value === "fade" || value === "zoom" || value === "slide" ? value : "slide";
}

function parseTransitionOut(value: unknown): VisualScene["transitionOut"] {
  return value === "fade" || value === "slide" || value === "cut" ? value : "fade";
}

function sanitizePayload(payload: Record<string, unknown>, sourceText: string): Record<string, unknown> {
  const sourceWords = new Set(cleanText(sourceText).toLowerCase().split(/\s+/).map((word) => word.replace(/[^\p{L}\p{N}%$₽-]+/gu, "")));
  const sanitizeValue = (value: unknown): unknown => {
    if (typeof value === "number") return value;
    if (typeof value === "string") return keepGroundedText(value, sourceWords, sourceText);
    if (Array.isArray(value)) return value.map(sanitizeValue);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, sanitizeValue(entry)]));
    }
    return value;
  };
  return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, sanitizeValue(value)]));
}

function keepGroundedText(value: string, sourceWords: Set<string>, sourceText: string) {
  const words = cleanText(value).split(/\s+/);
  const grounded = words.filter((word) => {
    const token = word.toLowerCase().replace(/[^\p{L}\p{N}%$₽-]+/gu, "");
    return !token || sourceWords.has(token);
  });
  return grounded.length >= Math.max(1, Math.ceil(words.length * 0.58)) ? cleanText(value) : firstSentence(sourceText);
}
