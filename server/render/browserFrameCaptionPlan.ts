import type { SubtitleDraft, TranscriptJson, TranscriptWord } from "@/lib/types";
import type { BrowserFrameCaption, BrowserFrameWord } from "./browserFrameRendererPlan";

export function buildCaptionsForBrowserPlan(
  subtitles: SubtitleDraft[],
  maxDurationSeconds: number,
  diagnostics?: {
    captionSource?: "transcript_edl_clean_time" | "subtitles_draft_fallback";
    edlApplied?: boolean;
    subtitlesDraftUsed?: boolean;
    warnings?: string[];
  }
) {
  const captions: BrowserFrameCaption[] = [];

  for (const subtitle of subtitles) {
    if (subtitle.start >= maxDurationSeconds) break;
    const words = subtitle.words
      .filter((word) => word.end <= maxDurationSeconds + 0.001)
      .map((word) => ({ text: word.word, start: word.start, end: word.end }));
    if (!words.length) continue;

    const chunks = chunkSubtitleWords(words);
    for (const chunk of chunks) {
      if (isFillerOnlyChunk(chunk)) continue;
      captions.push({
        id: `caption-${captions.length + 1}`,
        start: chunk[0].start,
        end: chunk.at(-1)?.end ?? chunk[0].end,
        text: cleanText(chunk.map((word) => word.text).join(" ")),
        lines: splitCaptionLines(chunk.map((word) => word.text)),
        words: chunk,
        highlightedWords: selectHighlightedWords(chunk)
      });
    }
  }

  return {
    captions: captions.filter((caption) => caption.end > caption.start),
    captionSource: diagnostics?.captionSource ?? "subtitles_draft_fallback",
    edlApplied: diagnostics?.edlApplied ?? false,
    subtitlesDraftUsed: diagnostics?.subtitlesDraftUsed ?? true,
    warnings: diagnostics?.warnings ?? []
  };
}

export function chunkSubtitleWords(words: BrowserFrameWord[]) {
  const chunks: BrowserFrameWord[][] = [];
  let current: BrowserFrameWord[] = [];

  for (const word of words) {
    const next = [...current, word];
    if (current.length && shouldBreakChunk(current, word, next)) {
      chunks.push(current);
      current = [word];
      continue;
    }
    current = next;
  }

  if (current.length) chunks.push(current);
  return rebalanceTinyTrailingChunk(chunks);
}

export function splitCaptionLines(words: string[]) {
  const normalized = words.map(cleanWordText).filter(Boolean);
  const text = cleanText(normalized.join(" "));
  if (text.length <= 34) return [text];

  let bestSplit = -1;
  let bestPenalty = Number.POSITIVE_INFINITY;

  for (let index = 1; index < normalized.length; index += 1) {
    const left = cleanText(normalized.slice(0, index).join(" "));
    const right = cleanText(normalized.slice(index).join(" "));
    if (!left || !right) continue;
    if (left.length > 34 || right.length > 34) continue;

    const penalty = Math.abs(left.length - right.length)
      + phraseBreakPenalty(normalized[index - 1], normalized[index]);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestSplit = index;
    }
  }

  if (bestSplit < 0) return [text];
  return [
    cleanText(normalized.slice(0, bestSplit).join(" ")),
    cleanText(normalized.slice(bestSplit).join(" "))
  ];
}

export function selectHighlightedWords(words: BrowserFrameWord[]) {
  const scored = words
    .map((word, index) => ({ normalized: normalizeWord(word.text), index, score: highlightScore(word.text) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);

  return scored.slice(0, 2).map((entry) => entry.normalized);
}

export function buildSubtitleDraftLocal(transcript: TranscriptJson) {
  return subtitlesFromWords(wordsFromTranscript(transcript));
}

export function buildSubtitlesForEdlLocal(
  transcript: TranscriptJson,
  edl: { keptRanges: Array<{ sourceStart: number; sourceEnd: number }> }
) {
  const remappedWords: TranscriptWord[] = [];
  let outputCursor = 0;
  const sourceWords = wordsFromTranscript(transcript);
  const usedWords = new Set<number>();

  for (const range of edl.keptRanges) {
    for (const [wordIndex, word] of sourceWords.entries()) {
      if (usedWords.has(wordIndex)) continue;
      const overlapStart = Math.max(word.start, range.sourceStart);
      const overlapEnd = Math.min(word.end, range.sourceEnd);
      if (overlapEnd - overlapStart < 0.05) continue;

      const start = outputCursor + Math.max(0, overlapStart - range.sourceStart);
      const end = outputCursor + Math.max(start - outputCursor, overlapEnd - range.sourceStart);
      remappedWords.push({ ...word, start, end: Math.max(end, start + 0.08) });
      usedWords.add(wordIndex);
    }
    outputCursor += Math.max(0, range.sourceEnd - range.sourceStart);
  }

  return subtitlesFromWords(remappedWords);
}

function shouldBreakChunk(current: BrowserFrameWord[], nextWord: BrowserFrameWord, next: BrowserFrameWord[]) {
  const currentText = cleanText(current.map((word) => word.text).join(" "));
  const nextText = cleanText(next.map((word) => word.text).join(" "));
  const gap = nextWord.start - (current.at(-1)?.end ?? nextWord.start);

  if (gap > 0.55) return true;
  if (next.length > 7) return true;
  if (nextText.length > 56) return true;
  if (current.length >= 4 && nextText.length > 46) return true;
  if (currentText.length >= 18 && /[.!?]$/.test(current.at(-1)?.text ?? "")) return true;
  return false;
}

function rebalanceTinyTrailingChunk(chunks: BrowserFrameWord[][]) {
  if (chunks.length < 2) return chunks;
  const last = chunks.at(-1);
  const prev = chunks.at(-2);
  if (!last || !prev || last.length >= 3 || prev.length <= 3) return chunks;

  while (last.length < 3 && prev.length > 3) {
    const moved = prev.pop();
    if (!moved) break;
    last.unshift(moved);
  }
  return chunks;
}

function phraseBreakPenalty(left: string, right: string) {
  const softWords = new Set(["и", "а", "но", "что", "как", "в", "на", "с", "к", "по"]);
  let penalty = 0;
  if (softWords.has(normalizeWord(left))) penalty += 12;
  if (softWords.has(normalizeWord(right))) penalty += 12;
  return penalty;
}

function highlightScore(text: string) {
  const normalized = normalizeWord(text);
  if (!normalized) return 0;
  if (/[0-9]/.test(normalized)) return 120;
  if (/%|процент|процентов|процента/.test(normalized)) return 110;
  if (/₽|руб|рубл|доллар|\$|€/.test(text.toLowerCase())) return 108;

  const priorityWords = new Map([
    ["ошибка", 100],
    ["важно", 98],
    ["результат", 96],
    ["клиенты", 94],
    ["деньги", 92],
    ["быстро", 90],
    ["система", 88]
  ]);

  return priorityWords.get(normalized) ?? 0;
}

function cleanText(text: string) {
  return text
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanWordText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeWord(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}%$€₽-]+/gu, "");
}

function isFillerOnlyChunk(words: BrowserFrameWord[]) {
  const fillerWords = new Set([
    "ааа",
    "аа",
    "эээ",
    "ээ",
    "эм",
    "эмм",
    "мм",
    "ммм",
    "нуу",
    "нууу"
  ]);

  return words.length > 0 && words.every((word) => fillerWords.has(normalizeWord(word.text)));
}

function wordsFromTranscript(transcript: TranscriptJson) {
  const words: TranscriptWord[] = [];
  for (const segment of transcript.segments) {
    if (segment.words?.length) {
      words.push(...segment.words);
      continue;
    }
    const segmentWords = segment.text.split(/\s+/).filter(Boolean);
    for (const [index, word] of segmentWords.entries()) {
      const start = segment.start + ((segment.end - segment.start) / Math.max(segmentWords.length, 1)) * index;
      const end = segment.start + ((segment.end - segment.start) / Math.max(segmentWords.length, 1)) * (index + 1);
      words.push({ word, start, end });
    }
  }
  return words.sort((left, right) => left.start - right.start);
}

function subtitlesFromWords(words: TranscriptWord[]) {
  return chunkSubtitleWords(
    words.map((word) => ({ text: word.word, start: word.start, end: word.end }))
  ).map((chunk, index) => ({
    id: `draft-${index}`,
    start: chunk[0].start,
    end: chunk.at(-1)?.end ?? chunk[0].end,
    text: cleanText(chunk.map((word) => word.text).join(" ")),
    words: chunk.map((word) => ({ word: word.text, start: word.start, end: word.end })),
    highlightedWords: []
  }));
}
