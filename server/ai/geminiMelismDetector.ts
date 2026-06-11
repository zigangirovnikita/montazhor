import { readFile, stat } from "node:fs/promises";
import { callChatCompletion } from "@/server/ai/openRouterClient";
import type { AiConfig } from "@/lib/config";
import type { EditRange, TranscriptJson } from "@/lib/types";
import type { VoiceActivityMap } from "@/server/ai/voiceActivity";
import { GEMINI_MELISM_DETECTOR_ENABLED } from "@/server/ai/cutTimingPolicy";

export type MelismCandidate = {
  id: string;
  type:
    | "elongated_hesitation"
    | "filler_word"
    | "untranscribed_voice"
    | "breath"
    | "mouth_sound"
    | "false_start"
    | "uncertain";
  text?: string;
  approximateStart?: number;
  approximateEnd?: number;
  beforeWordIndex?: number;
  afterWordIndex?: number;
  beforeWordText?: string;
  afterWordText?: string;
  confidence: number;
  action: "remove" | "review" | "keep";
  reason: string;
};

export type GeminiMelismDetectionResult = {
  autoRemoveCandidates: MelismCandidate[];
  reviewCandidates: MelismCandidate[];
  keepCandidates: MelismCandidate[];
  rawModelResponse?: unknown;
};

export type GeminiMelismDetectionInput = {
  audioPath: string;
  transcript: TranscriptJson;
  vad?: VoiceActivityMap;
  gapCandidates?: EditRange[];
  untranscribedVoiceCandidates?: EditRange[];
  cleanupMode: string;
  log?: (message: string) => void;
};

export async function detectGeminiMelismRemovals(
  input: GeminiMelismDetectionInput
): Promise<GeminiMelismDetectionResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey || !GEMINI_MELISM_DETECTOR_ENABLED) {
    input.log?.("Gemini Melism Detector is disabled or missing API key.");
    return { autoRemoveCandidates: [], reviewCandidates: [], keepCandidates: [] };
  }

  const systemPrompt = `Ты анализируешь русскую разговорную речь для автоматического монтажа коротких видео.
Твоя задача - найти речевой мусор, который можно удалить без потери смысла:
- эээ, эммм, ммм, ааа
- нууу, воооот, типааа, корочеее, значииит
- протяжные звуки размышления
- зависания
- мычание
- неосмысленные вокализации
- голосовые куски, которые не являются словами
- неудачные микростарты перед нормальной фразой

Не удаляй:
- смысловые "ну", "вот", "короче", если они работают как часть фразы;
- эмоциональные междометия, если они важны по смыслу;
- нормальные слова;
- куски, где ты не уверен.

Верни JSON строго по схеме:
{
  "candidates": [
    {
      "id": "уникальный_id",
      "type": "elongated_hesitation | filler_word | untranscribed_voice | breath | mouth_sound | false_start | uncertain",
      "text": "текст или описание звука",
      "beforeWordIndex": число (индекс слова ДО мусора),
      "afterWordIndex": число (индекс слова ПОСЛЕ мусора),
      "beforeWordText": "слово ДО",
      "afterWordText": "слово ПОСЛЕ",
      "confidence": 0.0 - 1.0,
      "action": "remove | review | keep",
      "reason": "почему ты принял такое решение"
    }
  ]
}

Таймингам, которые ты сам определяешь, не нужно быть идеальными.
Главное - укажи, между какими словами находится мусор (beforeWordIndex и afterWordIndex).
Если не уверен - action="review".
Если точно мусор - action="remove".
Если это нормальная часть речи - action="keep".`;

  // Provide words to Gemini
  const words = input.transcript.segments.flatMap((s) => s.words ?? []).map((w, i) => ({
    index: i,
    word: w.word,
    start: w.start,
    end: w.end
  }));

  const userPrompt = JSON.stringify({
    cleanup_mode: input.cleanupMode,
    transcript_words: words,
    vad_speech_ranges: input.vad?.speechRanges ?? [],
    gap_candidates_between_words: input.gapCandidates ?? buildWordGapCandidates(words),
    untranscribed_voice_candidates: input.untranscribedVoiceCandidates ?? []
  }, null, 2);

  const config: AiConfig = {
    provider: process.env.GEMINI_PROVIDER === "kie" ? "kie" : "openrouter",
    model: process.env.GEMINI_MODEL || "google/gemini-3-flash-preview",
    apiKey: apiKey,
    completionsUrl: process.env.GEMINI_BASE_URL || "https://openrouter.ai/api/v1/chat/completions",
    maxTokens: 8192,
    temperature: 0.1,
    includeModelInRequest: true
  };

  const audio = await maybeEncodeAudio(input.audioPath, input.log);
  input.log?.(`Sending transcript${audio ? " + audio" : ""} to Gemini Melism Detector...`);
  const aiResult = await callChatCompletion(config, systemPrompt, userPrompt, audio ? { audio } : {});
  
  let candidates: MelismCandidate[] = [];
  try {
    const parsed = JSON.parse(extractJson(aiResult.content));
    candidates = Array.isArray(parsed.candidates)
      ? parsed.candidates.map(coerceCandidate).filter((item: MelismCandidate | undefined): item is MelismCandidate => Boolean(item))
      : [];
  } catch {
    input.log?.("Failed to parse Gemini response as JSON");
    return { autoRemoveCandidates: [], reviewCandidates: [], keepCandidates: [], rawModelResponse: aiResult.content };
  }

  const autoRemoveCandidates = candidates.filter(c => c.action === "remove");
  const reviewCandidates = candidates.filter(c => c.action === "review");
  const keepCandidates = candidates.filter(c => c.action === "keep");

  input.log?.(`Gemini candidates: ${candidates.length} total / ${autoRemoveCandidates.length} auto-remove / ${reviewCandidates.length} review / ${keepCandidates.length} keep`);

  return { autoRemoveCandidates, reviewCandidates, keepCandidates, rawModelResponse: candidates };
}

function buildWordGapCandidates(words: { index: number; word: string; start: number; end: number }[]): EditRange[] {
  const gaps: EditRange[] = [];
  for (let index = 1; index < words.length; index += 1) {
    const previous = words[index - 1];
    const current = words[index];
    if (current.start - previous.end >= 0.15) {
      gaps.push({
        sourceStart: previous.end,
        sourceEnd: current.start,
        reason: "word_gap",
        text: `${previous.word} -> ${current.word}`,
      });
    }
  }
  return gaps;
}

function extractJson(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1);
  return trimmed;
}

function coerceCandidate(input: unknown): MelismCandidate | undefined {
  const item = input as Partial<MelismCandidate>;
  if (typeof item !== "object" || item === null) return undefined;
  if (item.action !== "remove" && item.action !== "review" && item.action !== "keep") return undefined;
  if (typeof item.confidence !== "number" || !Number.isFinite(item.confidence)) return undefined;
  if (!isCandidateType(item.type)) return undefined;

  return {
    id: typeof item.id === "string" ? item.id : `gemini-${Math.random().toString(36).slice(2)}`,
    type: item.type,
    text: typeof item.text === "string" ? item.text : undefined,
    approximateStart: numberOrUndefined(item.approximateStart),
    approximateEnd: numberOrUndefined(item.approximateEnd),
    beforeWordIndex: integerOrUndefined(item.beforeWordIndex),
    afterWordIndex: integerOrUndefined(item.afterWordIndex),
    beforeWordText: typeof item.beforeWordText === "string" ? item.beforeWordText : undefined,
    afterWordText: typeof item.afterWordText === "string" ? item.afterWordText : undefined,
    confidence: Math.max(0, Math.min(1, item.confidence)),
    action: item.action,
    reason: typeof item.reason === "string" ? item.reason : "Gemini melism detector candidate",
  };
}

function isCandidateType(value: unknown): value is MelismCandidate["type"] {
  return (
    value === "elongated_hesitation" ||
    value === "filler_word" ||
    value === "untranscribed_voice" ||
    value === "breath" ||
    value === "mouth_sound" ||
    value === "false_start" ||
    value === "uncertain"
  );
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function integerOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

async function maybeEncodeAudio(
  audioPath: string,
  log: ((message: string) => void) | undefined
): Promise<{ data: string; format: string } | undefined> {
  if ((process.env.GEMINI_MELISM_AUDIO_ENABLED ?? "true") !== "true") return undefined;

  const maxBytes = Number(process.env.GEMINI_MELISM_AUDIO_MAX_BYTES ?? "6000000");
  try {
    const file = await stat(audioPath);
    if (file.size > maxBytes) {
      log?.(`Gemini audio input skipped: WAV is ${file.size} bytes, max is ${maxBytes}.`);
      return undefined;
    }

    return {
      data: (await readFile(audioPath)).toString("base64"),
      format: "wav",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log?.(`Gemini audio input skipped: ${message}`);
    return undefined;
  }
}
