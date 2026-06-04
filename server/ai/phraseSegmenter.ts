import type { SubtitleDraft, TranscriptWord, VisualPhrase, SemanticRole, ContentPlan } from "@/lib/types";

const warningWords = ["ошибка", "внимание", "стоп", "важно", "проблема", "опасно", "миф"];
const listWords = ["первое", "второе", "третье", "во-первых", "шаг", "этап", "правило", "причина", "способ"];
const ctaWords = ["подпишись", "переходи", "ссылка", "читай", "смотри", "сохрани", "забирай"];
const connectorWords = ["поэтому", "значит", "короче", "в итоге", "однако", "но", "а", "и", "так вот"];

export function segmentIntoPhrases(subtitles: SubtitleDraft[], contentPlan: ContentPlan): VisualPhrase[] {
  const phrases: VisualPhrase[] = [];
  let currentGroup: SubtitleDraft[] = [];
  let currentWords: TranscriptWord[] = [];
  
  for (let i = 0; i < subtitles.length; i++) {
    const sub = subtitles[i]!;
    currentGroup.push(sub);
    currentWords.push(...sub.words);
    
    // Check if we should close the phrase
    const isLast = i === subtitles.length - 1;
    const isPunctuationEnd = /[.!?]$/.test(sub.text.trim());
    const nextStartsCapital = !isLast && /^[A-ZА-ЯЁ]/.test(subtitles[i+1]!.text.trim());
    const isTooLong = currentWords.length >= 10 || (currentWords.length > 0 && sub.end - currentWords[0]!.start > 5.5);
    
    if (isLast || isPunctuationEnd || nextStartsCapital || isTooLong) {
      phrases.push(buildPhrase(currentGroup, currentWords, phrases.length, isLast, contentPlan));
      currentGroup = [];
      currentWords = [];
    }
  }
  
  return phrases;
}

function buildPhrase(
  subs: SubtitleDraft[], 
  words: TranscriptWord[], 
  index: number, 
  isLast: boolean, 
  contentPlan: ContentPlan
): VisualPhrase {
  const fullText = subs.map(s => s.text).join(" ").trim();
  const lowerText = fullText.toLowerCase();
  
  let role: SemanticRole = "statement";
  
  // 1. Check for specific roles
  const numberMatch = lowerText.match(/(?:\d+[.,]?\d*|[0-9]+)\s?(?:%|к|k|тыс|млн|x|раз|₽|\$)?/i);
  const containsNumber = !!numberMatch;
  const containsList = containsAny(lowerText, listWords);
  
  if (isLast && containsAny(lowerText, ctaWords)) {
    role = "cta";
  } else if (containsAny(lowerText, warningWords)) {
    role = "warning";
  } else if (containsList) {
    role = "list_item";
  } else if (containsNumber) {
    role = "number";
  } else if (containsAny(lowerText, connectorWords) && words.length <= 4) {
    role = "connector";
  } else if (subs.some(s => s.highlightedWords.length > 0) || (contentPlan.hook && lowerText.includes(contentPlan.hook.toLowerCase()))) {
    role = "emphasis";
  }
  
  // 2. Identify emphasis words
  const emphasisWords: string[] = [];
  subs.forEach(s => emphasisWords.push(...s.highlightedWords));
  
  if (emphasisWords.length === 0 && words.length > 0) {
    // Pick the longest word as fallback emphasis if none found
    let longest = words[0]!;
    for (const w of words) {
      if (w.word.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, "").length > longest.word.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, "").length) {
        longest = w;
      }
    }
    if (longest.word.length > 4) {
      emphasisWords.push(longest.word.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ""));
    }
  }
  
  // 3. Calculate density
  const duration = words[words.length - 1]!.end - words[0]!.start;
  const wordsPerSecond = words.length / duration;
  let density: "sparse" | "normal" | "dense" = "normal";
  
  if (wordsPerSecond > 3.2 || words.length > 8) density = "dense";
  else if (wordsPerSecond < 1.8 || words.length <= 3) density = "sparse";

  return {
    id: `phrase-${index}`,
    start: words[0]!.start,
    end: words[words.length - 1]!.end,
    text: fullText,
    words: words,
    semanticRole: role,
    emphasisWords: Array.from(new Set(emphasisWords)),
    density,
    containsNumber,
    containsList
  };
}

function containsAny(text: string, words: string[]): boolean {
  return words.some(w => text.includes(w));
}
