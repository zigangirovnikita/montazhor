import type { ContentPlan, SubtitleDraft, TranscriptWord, VisualMomentType } from "@/lib/types";

export interface TimedVisualSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  words: TranscriptWord[];
  type: VisualMomentType;
  reason: string;
}

const greetingWords = new Set(["привет", "здравствуйте", "hello", "hi", "hey"]);
const numberUnits = new Set(["лет", "год", "года", "рублей", "рубля", "руб", "процентов", "раз", "к", "тысяч", "тыс", "млн"]);
const listMarkers = new Set(["первое", "второе", "третье", "четвертое", "во-первых", "во-вторых", "шаг", "пункт", "причина"]);
const warningWords = new Set(["важно", "ошибка", "внимание", "стоп", "нельзя", "опасно", "проблема"]);
const ctaWords = new Set(["подпишись", "сохрани", "забирай", "переходи", "смотри", "читай"]);
const growthWords = new Set(["растет", "растут", "вырос", "выросли", "набирает", "набирают", "увеличивается", "growth", "increase"]);
const weakLeadWords = new Set(["и", "а", "но"]);
const numberLeadWords = new Set(["мне", "ему", "ей", "нам", "им", "тебе", "вам", "мной"]);

export function buildTimedVisualSegments(subtitles: SubtitleDraft[], contentPlan: ContentPlan, duration: number): TimedVisualSegment[] {
  const words = uniqueWords(subtitles.flatMap((subtitle) => subtitle.words)).filter((word) => word.end > word.start);
  const segments: TimedVisualSegment[] = [];
  let index = 0;

  while (index < words.length) {
    const startIndex = index;
    const first = normalized(words[index]!.word);
    let endIndex = index + 1;

    if (weakLeadWords.has(first) && isNumberLeadIn(words, index + 1)) {
      index += 1;
      continue;
    }

    if (segments.length === 0 && greetingWords.has(first)) {
      endIndex = index + 1;
    } else if (matchesNameIntro(words, index)) {
      endIndex = Math.min(words.length, index + 3);
    } else if (isNumberLeadIn(words, index)) {
      endIndex = extendNumberLeadInSpan(words, index);
    } else if (containsNumber(words[index]!)) {
      endIndex = extendNumberSpan(words, index);
    } else {
      endIndex = extendSpeechSpan(words, index);
    }

    const spanWords = words.slice(startIndex, endIndex);
    const text = cleanText(spanWords.map((word) => word.word).join(" "));
    if (text) {
      segments.push({
        id: `spoken-${segments.length}`,
        start: Math.max(0, spanWords[0]!.start),
        end: Math.min(duration, spanWords.at(-1)!.end),
        text,
        words: spanWords,
        type: classifySegment(spanWords, text, contentPlan, endIndex >= words.length),
        reason: `Timed speech segment, ${spanWords.length} words`
      });
    }

    index = Math.max(endIndex, index + 1);
  }

  return mergeTinySegments(segments, duration);
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

function matchesNameIntro(words: TranscriptWord[], index: number) {
  const phrase = words.slice(index, index + 2).map((word) => normalized(word.word)).join(" ");
  return phrase === "меня зовут" || phrase === "my name";
}

function isNumberLeadIn(words: TranscriptWord[], index: number) {
  const token = words[index] ? normalized(words[index]!.word) : "";
  return numberLeadWords.has(token) && Boolean(words[index + 1] && containsNumber(words[index + 1]!));
}

function extendNumberLeadInSpan(words: TranscriptWord[], index: number) {
  return extendNumberSpan(words, index + 1);
}

function extendNumberSpan(words: TranscriptWord[], index: number) {
  let end = index + 1;
  while (end < words.length && end < index + 4) {
    const token = normalized(words[end]!.word);
    if (!numberUnits.has(token) && !containsNumber(words[end]!)) break;
    end += 1;
  }
  return end;
}

function extendSpeechSpan(words: TranscriptWord[], index: number) {
  let end = index + 1;
  let hasGrowthCue = growthWords.has(normalized(words[index]!.word));
  while (end < words.length && end - index < 5) {
    const previous = words[end - 1]!;
    const current = words[end]!;
    const gap = current.start - previous.end;
    const token = normalized(current.word);
    if (gap > 0.32) break;
    if (/[.!?]$/.test(previous.word)) break;
    if (growthWords.has(token)) hasGrowthCue = true;
    if (containsNumber(current) && !hasGrowthCue) break;
    if (listMarkers.has(token) || warningWords.has(token)) break;
    if (containsNumber(previous) && hasGrowthCue) break;
    end += 1;
  }
  return end;
}

function classifySegment(words: TranscriptWord[], text: string, contentPlan: ContentPlan, isLast: boolean): VisualMomentType {
  const tokens = words.map((word) => normalized(word.word));
  const lower = text.toLowerCase();
  const numberCount = words.filter(containsNumber).length;

  if (isLast && tokens.some((token) => ctaWords.has(token))) return "cta";
  if (tokens.some((token) => warningWords.has(token))) return "warning";
  if (tokens.some((token) => listMarkers.has(token))) return "list";
  if (numberCount >= 2 || tokens.some((token) => growthWords.has(token))) return "chart";
  if (numberCount === 1) return "number";
  if (contentPlan.hook && lower.includes(contentPlan.hook.toLowerCase())) return "keyword";
  if (contentPlan.keyPhrases.some((phrase) => phrase && lower.includes(phrase.toLowerCase()))) return "keyword";
  return "kinetic_text";
}

function mergeTinySegments(segments: TimedVisualSegment[], duration: number) {
  const result: TimedVisualSegment[] = [];
  for (const segment of segments) {
    const previous = result.at(-1);
    if (
      previous &&
      segment.type === "kinetic_text" &&
      previous.type === "kinetic_text" &&
      segment.words.length <= 1 &&
      previous.words.length + segment.words.length <= 5 &&
      segment.start - previous.end < 0.22
    ) {
      previous.words.push(...segment.words);
      previous.end = Math.min(duration, segment.end);
      previous.text = cleanText(previous.words.map((word) => word.word).join(" "));
      continue;
    }
    result.push({ ...segment, id: `spoken-${result.length}` });
  }
  return result;
}

function containsNumber(word: TranscriptWord) {
  return /\d/.test(word.word);
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}%$₽-]+/gu, "");
}

function cleanText(text: string) {
  return text.replace(/\s+([,.!?;:])/g, "$1").replace(/\s+/g, " ").trim();
}
