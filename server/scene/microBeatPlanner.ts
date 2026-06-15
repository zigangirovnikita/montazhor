import type { SceneMicroBeat, SemanticBlock, TranscriptWord } from "@/lib/types";

const NUMBER_RE = /\d/;

export function buildMicroBeatsForBlock(block: SemanticBlock, words: TranscriptWord[]): SceneMicroBeat[] {
  if (words.length === 0) return [];

  const beats: SceneMicroBeat[] = [];
  let lastAnchor = words[0]!.start;

  words.forEach((word, index) => {
    const isLast = index === words.length - 1;
    const durationFromLast = word.start - lastAnchor;
    const keyword = pickBeatType(word.word, index, words.length);
    if (!keyword) return;
    if (!isLast && durationFromLast < 0.45 && !NUMBER_RE.test(word.word)) return;
    beats.push({
      id: `${block.id}-beat-${String(beats.length + 1).padStart(2, "0")}`,
      type: keyword,
      start: round(word.start),
      end: round(Math.max(word.end, Math.min(block.end, word.start + 0.45))),
      anchorText: word.word,
      anchorWordRange: {
        startIndex: block.transcriptWordRange.startIndex + index,
        endIndex: block.transcriptWordRange.startIndex + index
      },
      payload: NUMBER_RE.test(word.word) ? { value: word.word } : undefined
    });
    lastAnchor = word.start;
  });

  if (beats.length === 0 || block.end - block.start > 3.1) {
    const fallbackWord = words[Math.min(1, words.length - 1)] ?? words[0]!;
    beats.push({
      id: `${block.id}-beat-safe`,
      type: block.type === "list" ? "label_reveal" : "subtitle_emphasis",
      start: round(Math.max(block.start, fallbackWord.start)),
      end: round(Math.min(block.end, fallbackWord.end + 0.6)),
      anchorText: fallbackWord.word
    });
  }

  return beats.slice(0, 6);
}

function pickBeatType(word: string, index: number, total: number): SceneMicroBeat["type"] | null {
  if (NUMBER_RE.test(word)) return "number_emphasis";
  if (index === 0) return "label_reveal";
  if (index === total - 1) return "background_shift";
  if (word.length >= 7) return "keyword_highlight";
  if (/^[A-ZА-Я]/.test(word)) return "subtitle_emphasis";
  return index % 2 === 0 ? "panel_state_change" : null;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
