import { getAiConfigForTask } from "@/lib/config";
import type { Aggressiveness, KeepSegment, RejectedTake, ScriptSelectionPlan, TranscriptJson } from "@/lib/types";
import { callChatCompletion } from "@/server/ai/openRouterClient";
import { recordAiUsage } from "@/server/ai/usage";
import {
  buildScriptSelectionReviewSystemPrompt,
  buildScriptSelectionReviewUserPrompt,
  buildScriptSelectionSystemPrompt,
  buildScriptSelectionUserPrompt,
} from "@/server/ai/scriptSelectionPrompts";

const SNAP_TOLERANCE = 0.5;
const MIN_KEEP_CONFIDENCE = 0.45;
const MIN_KEEP_DURATION = 0.5;
const DUPLICATE_KEEP_OVERLAP = 0.45;

interface WordTiming {
  word: string;
  start: number;
  end: number;
}

interface RawRejectedTake {
  start: number;
  end: number;
  text?: string;
  reason?: RejectedTake["reason"];
}

export async function selectScriptWithAi(
  transcript: TranscriptJson,
  aggressiveness: Aggressiveness,
  duration: number,
  log?: (message: string) => void,
  projectId?: string
): Promise<ScriptSelectionPlan> {
  const pass1Config = getAiConfigForTask("script_selector_pass_1");
  const pass2Config = getAiConfigForTask("script_selector_pass_2");
  const info = log ?? (() => {});

  if (!pass1Config.apiKey) {
    throw new Error(`${pass1Config.provider} API key is not set. Add it to your .env file to enable script selection pass 1.`);
  }
  if (!pass2Config.apiKey) {
    throw new Error(`${pass2Config.provider} API key is not set. Add it to your .env file to enable script selection pass 2.`);
  }

  info(`AI script selector: Pass 1 keep-plan using ${pass1Config.provider}/${pass1Config.model}...`);
  const pass1 = await callChatCompletion(
    pass1Config,
    buildScriptSelectionSystemPrompt(transcript.language, aggressiveness),
    buildScriptSelectionUserPrompt(transcript)
  );
  await recordAiUsage({ projectId, source: "script_selector", phase: "pass_1_keep_plan", result: pass1 });
  const plan = validateScriptSelectionPlan(parseScriptSelectionResponse(pass1.content), transcript, duration, info, "Script selector pass 1");
  info(`AI script selector: Pass 1 kept ${plan.keepSegments.length} final-script segments.`);

  info(`AI script selector: Pass 2 review keep-plan using ${pass2Config.provider}/${pass2Config.model}...`);
  const pass2 = await callChatCompletion(
    pass2Config,
    buildScriptSelectionReviewSystemPrompt(transcript.language),
    buildScriptSelectionReviewUserPrompt(transcript, plan)
  );
  await recordAiUsage({ projectId, source: "script_selector", phase: "pass_2_review", result: pass2 });
  const reviewed = validateScriptSelectionPlan(parseScriptSelectionResponse(pass2.content), transcript, duration, info, "Script selector review");
  info(`AI script selector: review kept ${reviewed.keepSegments.length} final-script segments. Reasoning: ${reviewed.reasoning}`);

  return reviewed;
}

export function validateScriptSelectionPlan(
  plan: ScriptSelectionPlan,
  transcript: TranscriptJson,
  duration: number,
  log?: (message: string) => void,
  phase = "Script selection validation"
): ScriptSelectionPlan {
  const words = collectWordTimings(transcript);
  const rejected: string[] = [];

  const snappedSegments = plan.keepSegments
    .map((segment) => clampKeepSegment(segment, duration))
    .filter((segment) => segment.sourceEnd > segment.sourceStart)
    .map((segment) => snapKeepSegmentToWords(segment, words, rejected))
    .filter((segment): segment is KeepSegment => Boolean(segment))
    .flatMap((segment) => splitKeepSegmentByTranscriptSegments(segment, transcript));

  const keepSegments = dropEarlierDuplicateKeeps(mergeKeepSegments(
    snappedSegments
      .filter((segment) => {
        const accepted = segment.confidence >= MIN_KEEP_CONFIDENCE;
        if (!accepted) {
          rejected.push(`${formatRange(segment.sourceStart, segment.sourceEnd)} "${segment.text}" rejected: low confidence ${segment.confidence.toFixed(2)}`);
        }
        return accepted;
      })
      .filter((segment) => {
        const accepted = segment.sourceEnd - segment.sourceStart >= MIN_KEEP_DURATION;
        if (!accepted) {
          rejected.push(`${formatRange(segment.sourceStart, segment.sourceEnd)} "${segment.text}" rejected: too short to keep`);
        }
        return accepted;
      })
  ), rejected);

  for (const item of rejected) log?.(`${phase}: ${item}`);

  return {
    reasoning: plan.reasoning,
    keepSegments,
    rejectedTakes: plan.rejectedTakes,
  };
}

function parseScriptSelectionResponse(raw: string): ScriptSelectionPlan {
  const parsed = parseJsonObject(raw);
  const keepSegments = Array.isArray(parsed.keep_segments)
    ? parseKeepSegments(parsed.keep_segments)
    : [];
  const rejectedTakes = Array.isArray(parsed.rejected_takes)
    ? parseRejectedTakes(parsed.rejected_takes)
    : [];

  return {
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    keepSegments,
    rejectedTakes,
  };
}

function parseKeepSegments(value: unknown[]): KeepSegment[] {
  return (value as Record<string, unknown>[])
    .filter((item) => typeof item.start === "number" && typeof item.end === "number" && item.end > item.start)
    .map((item) => ({
      sourceStart: item.start as number,
      sourceEnd: item.end as number,
      text: typeof item.text === "string" ? item.text : "",
      role: "final_script" as const,
      reason: typeof item.reason === "string" ? item.reason : "selected for final script",
      confidence: typeof item.confidence === "number" ? Math.min(1, Math.max(0, item.confidence)) : 0.75,
    }));
}

function parseRejectedTakes(value: unknown[]): RejectedTake[] {
  return (value as RawRejectedTake[])
    .filter((item) => typeof item.start === "number" && typeof item.end === "number" && item.end > item.start)
    .map((item) => ({
      sourceStart: item.start,
      sourceEnd: item.end,
      text: typeof item.text === "string" ? item.text : "",
      reason: parseRejectedReason(item.reason),
    }));
}

function parseRejectedReason(reason: unknown): RejectedTake["reason"] {
  if (reason === "earlier_duplicate" || reason === "technical_chatter" || reason === "abandoned_start" || reason === "off_narrative" || reason === "unsafe") {
    return reason;
  }
  return "off_narrative";
}

function collectWordTimings(transcript: TranscriptJson): WordTiming[] {
  const words: WordTiming[] = [];
  for (const segment of transcript.segments) {
    if (segment.words?.length) {
      for (const word of segment.words) {
        words.push({ word: word.word, start: word.start, end: word.end });
      }
      continue;
    }
    words.push({ word: segment.text, start: segment.start, end: segment.end });
  }
  return words.sort((a, b) => a.start - b.start);
}

function clampKeepSegment(segment: KeepSegment, duration: number): KeepSegment {
  return {
    ...segment,
    sourceStart: Math.max(0, Math.min(segment.sourceStart, duration)),
    sourceEnd: Math.max(0, Math.min(segment.sourceEnd, duration)),
  };
}

function snapKeepSegmentToWords(
  segment: KeepSegment,
  words: WordTiming[],
  rejected: string[]
): KeepSegment | undefined {
  let coveredWords = words.filter((word) => {
    const midpoint = (word.start + word.end) / 2;
    return midpoint >= segment.sourceStart && midpoint <= segment.sourceEnd;
  });

  if (coveredWords.length === 0) {
    coveredWords = words.filter((word) => {
      const midpoint = (word.start + word.end) / 2;
      return midpoint >= segment.sourceStart - SNAP_TOLERANCE && midpoint <= segment.sourceEnd + SNAP_TOLERANCE;
    });
  }

  if (coveredWords.length === 0) {
    rejected.push(`${formatRange(segment.sourceStart, segment.sourceEnd)} "${segment.text}" rejected: range covers no transcript words`);
    return undefined;
  }

  const first = coveredWords[0];
  const last = coveredWords[coveredWords.length - 1];
  return {
    ...segment,
    sourceStart: first.start,
    sourceEnd: last.end,
    text: coveredWords.map((word) => word.word).join(" ").replace(/\s+/g, " ").trim(),
  };
}

function mergeKeepSegments(segments: KeepSegment[]): KeepSegment[] {
  const sorted = [...segments].sort((a, b) => a.sourceStart - b.sourceStart);
  const merged: KeepSegment[] = [];

  for (const segment of sorted) {
    const previous = merged.at(-1);
    if (!previous || segment.sourceStart > previous.sourceEnd + 0.12) {
      merged.push({ ...segment });
      continue;
    }

    previous.sourceEnd = Math.max(previous.sourceEnd, segment.sourceEnd);
    previous.text = `${previous.text} ${segment.text}`.replace(/\s+/g, " ").trim();
    previous.reason = previous.reason === segment.reason ? previous.reason : "merged final-script fragments";
    previous.confidence = Math.min(previous.confidence, segment.confidence);
  }

  return merged;
}

function splitKeepSegmentByTranscriptSegments(segment: KeepSegment, transcript: TranscriptJson): KeepSegment[] {
  const pieces: KeepSegment[] = [];

  for (const transcriptSegment of transcript.segments) {
    const words = transcriptSegment.words ?? [];
    const segmentWords = words.filter(
      (word) => word.start >= segment.sourceStart && word.end <= segment.sourceEnd
    );
    if (segmentWords.length === 0) continue;

    const first = segmentWords[0];
    const last = segmentWords[segmentWords.length - 1];
    pieces.push({
      ...segment,
      sourceStart: first.start,
      sourceEnd: last.end,
      text: segmentWords.map((word) => word.word).join(" ").replace(/\s+/g, " ").trim(),
    });
  }

  return pieces.length > 0 ? pieces : [segment];
}

function dropEarlierDuplicateKeeps(segments: KeepSegment[], rejected: string[]): KeepSegment[] {
  const dropped = new Set<number>();

  for (let i = 0; i < segments.length; i++) {
    if (dropped.has(i)) continue;
    for (let j = i + 1; j < segments.length; j++) {
      if (dropped.has(j)) continue;
      const similarity = tokenOverlap(segments[i].text, segments[j].text);
      if (similarity < DUPLICATE_KEEP_OVERLAP) continue;

      dropped.add(i);
      rejected.push(
        `${formatRange(segments[i].sourceStart, segments[i].sourceEnd)} "${segments[i].text}" rejected: earlier duplicate of later keep segment ${formatRange(segments[j].sourceStart, segments[j].sourceEnd)}`
      );
      break;
    }
  }

  return segments.filter((_, index) => !dropped.has(index));
}

function tokenOverlap(left: string, right: string): number {
  const leftTokens = contentTokens(left);
  const rightTokens = new Set(contentTokens(right));
  if (leftTokens.length === 0 || rightTokens.size === 0) return 0;
  const overlap = leftTokens.filter((token) => rightTokens.has(token)).length;
  return overlap / Math.min(leftTokens.length, rightTokens.size);
}

function contentTokens(text: string): string[] {
  const tokens = new Set<string>();
  for (const raw of text.split(/\s+/)) {
    const normalized = raw.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    if (normalized.length < 4 || STOPWORDS.has(normalized)) continue;
    // Use 10-char stems to avoid false positives (e.g. 'результат' vs 'результативный')
    tokens.add(normalized.length > 10 ? normalized.slice(0, 10) : normalized);
  }
  return [...tokens];
}

function parseJsonObject(raw: string): Record<string, unknown> {
  let cleaned = raw.trim();
  // Strip BOM
  if (cleaned.charCodeAt(0) === 0xFEFF) cleaned = cleaned.slice(1);
  // Strip markdown code fences
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "");
  }
  // Extract JSON object if there's trailing text after the closing brace
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned) as Record<string, unknown>;
}

function formatRange(start: number, end: number) {
  return `${start.toFixed(2)}-${end.toFixed(2)}`;
}

const STOPWORDS = new Set([
  "это",
  "что",
  "как",
  "если",
  "после",
  "пока",
  "уже",
  "только",
  "может",
  "можно",
  "нельзя",
  "например",
  "также",
  "далее",
  "себя",
  "себе",
  "вам",
  "вас",
  "для",
  "при",
  "или",
  "and",
  "the",
  "that",
  "this",
  "with",
]);
