import type { TranscriptJson, EditDecisionList, ContentPlan, TranscriptWord } from "@/lib/types";
import type { VisualBeat, VisualBeatIntent } from "@/lib/types/visual";
import { cleanText } from "@/server/ai/visualPayload";

const NUMBER_RE = /(\d+[.,]?\d*)\s?(%|к|k|тыс|млн|x|раз|₽|\$)?/gi;
const WARNING_RE = /\b(ошибка|миф|нельзя|опасно|стоп|проблема|wrong|mistake|myth|premature|risk)\b/i;
const LIST_RE = /\b(первое|второе|третье|шаг|пункт|причина|когда|как|сколько|when|how|charge|first|second|third)\b/i;
const TRUST_RE = /\b(довер|trust|источник|source|earned|inherited|relationship|аудит|audit)\b/i;
const CTA_RE = /\b(подпиш|сохрани|забирай|переходи|смотри|читай|subscribe|follow|save|download|join)\b/i;
const QUOTE_RE = /["«»]/;
const COMPARE_RE = /\b(против|вместо|или|versus|vs|but|instead|before|after|до|после)\b/i;
const TIMELINE_RE = /\b(сначала|потом|затем|после|first|then|next|finally|step)\b/i;

export function extractVisualBeats(
  transcript: TranscriptJson,
  edl: EditDecisionList,
  contentPlan: ContentPlan
): VisualBeat[] {
  const keptWords = extractKeptWords(transcript, edl);
  if (keptWords.length === 0) return [];

  // Group into blocks by punctuation and pauses
  const blocks = buildTextBlocks(keptWords);
  const beats: VisualBeat[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const text = cleanText(block.words.map(w => w.word).join(" "));
    const start = block.words[0]?.start ?? 0;
    const end = block.words[block.words.length - 1]?.end ?? 0;

    let intent: VisualBeatIntent = "statement";
    let importance: 1 | 2 | 3 | 4 | 5 = 2;
    const entities: VisualBeat["entities"] = {};

    // Basic heuristic intent classification
    if (i === 0) {
      intent = "hook";
      importance = 5;
    } else if (WARNING_RE.test(text)) {
      intent = "mistake";
      importance = 4;
    } else if (COMPARE_RE.test(text)) {
      intent = "comparison";
      importance = 4;
    } else if (TIMELINE_RE.test(text) || LIST_RE.test(text)) {
      intent = "steps";
      importance = 4;
    } else if (QUOTE_RE.test(text)) {
      intent = "quote";
      importance = 3;
    } else if (CTA_RE.test(text)) {
      intent = "cta";
      importance = 5;
    } else if (text.match(NUMBER_RE)) {
      intent = "stat";
      importance = 3;
      entities.numbers = text.match(NUMBER_RE)?.map(m => m.trim()) || [];
    }

    beats.push({
      id: `beat-${i.toString().padStart(3, "0")}`,
      start,
      end,
      text,
      intent,
      importance,
      entities
    });
  }

  return beats;
}

function extractKeptWords(transcript: TranscriptJson, edl: EditDecisionList): TranscriptWord[] {
  const words: TranscriptWord[] = [];
  for (const seg of transcript.segments) {
    if (!seg.words) continue;
    for (const w of seg.words) {
      const mid = (w.start + w.end) / 2;
      const isKept = edl.keptRanges.some(r => mid >= r.sourceStart && mid <= r.sourceEnd);
      if (isKept) {
        words.push(w);
      }
    }
  }
  return words;
}

function buildTextBlocks(words: TranscriptWord[]) {
  const blocks: { words: TranscriptWord[] }[] = [];
  let currentBlock: TranscriptWord[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    currentBlock.push(word);

    const isLast = i === words.length - 1;
    const nextWord = !isLast ? words[i + 1] : null;
    const hasPunctuation = /[.!?]/.test(word.word);
    const hasLongPause = nextWord ? nextWord.start - word.end > 0.8 : false;
    const isLongEnough = currentBlock.length > 5;

    if (isLast || (hasPunctuation && isLongEnough) || hasLongPause) {
      blocks.push({ words: currentBlock });
      currentBlock = [];
    }
  }

  if (currentBlock.length > 0) {
    blocks.push({ words: currentBlock });
  }

  return blocks;
}
