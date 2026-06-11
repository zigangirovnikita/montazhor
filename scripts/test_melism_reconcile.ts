import assert from "node:assert/strict";
import { isFillerWord } from "@/server/ai/fillerWords";
import type { TranscriptJson } from "@/lib/types";
import type { MelismCandidate } from "@/server/ai/geminiMelismDetector";
import { normalizeTranscriptTimings } from "@/server/ai/transcriptTiming";
import { reconcileMelismCandidates } from "@/server/pipeline/steps/analyze/reconcileMelisms";

const transcript = normalizeTranscriptTimings(
  {
    provider: "fixture",
    language: "ru",
    duration: 5,
    segments: [{
      id: 0,
      start: 0,
      end: 4.4,
      text: "привет это важно",
      words: [
        { word: "привет", start: 0, end: 0.4, confidence: 0.9 },
        { word: "это", start: 1, end: 1.2, confidence: 0.9 },
        { word: "важно", start: 4, end: 4.4, confidence: 0.9 },
      ],
    }],
  } satisfies TranscriptJson,
  { duration: 5 }
).transcript;

assert.equal(transcript.segments.length, 1);
assert.equal(transcript.segments[0].words?.length, 3);
assert.ok((transcript.segments[0].words?.[1].start ?? 0) >= (transcript.segments[0].words?.[0].end ?? 0));

const accepted = reconcileMelismCandidates({
  transcript,
  duration: 5,
  candidates: [candidate({ beforeWordIndex: 0, afterWordIndex: 1, confidence: 0.91 })],
});
assert.equal(accepted.autoRemoveRanges.length, 1);
assert.equal(accepted.autoRemoveRanges[0].sourceStart, 0.48);
assert.equal(accepted.autoRemoveRanges[0].sourceEnd, 0.92);

const overlapsWord = reconcileMelismCandidates({
  transcript,
  duration: 5,
  candidates: [candidate({ beforeWordIndex: 0, afterWordIndex: 2, confidence: 0.95 })],
});
assert.equal(overlapsWord.autoRemoveRanges.length, 0);
assert.equal(overlapsWord.reviewItems.length, 1);

const tooLong = reconcileMelismCandidates({
  transcript,
  duration: 5,
  candidates: [candidate({ beforeWordIndex: 1, afterWordIndex: 2, confidence: 0.95 })],
});
assert.equal(tooLong.autoRemoveRanges.length, 0);
assert.equal(tooLong.reviewItems.length, 1);

const lowConfidence = reconcileMelismCandidates({
  transcript,
  duration: 5,
  candidates: [candidate({ beforeWordIndex: 0, afterWordIndex: 1, confidence: 0.6 })],
});
assert.equal(lowConfidence.autoRemoveRanges.length, 0);
assert.equal(lowConfidence.reviewItems.length, 1);

const keep = reconcileMelismCandidates({
  transcript,
  duration: 5,
  candidates: [candidate({ beforeWordIndex: 0, afterWordIndex: 1, action: "keep", confidence: 0.9 })],
});
assert.equal(keep.autoRemoveRanges.length, 0);
assert.equal(keep.keepItems.length, 1);

const approximateWithVad = reconcileMelismCandidates({
  transcript,
  duration: 5,
  vad: { provider: "silero-vad", speechRanges: [{ start: 2, end: 2.6 }] },
  candidates: [candidate({
    beforeWordIndex: undefined,
    afterWordIndex: undefined,
    approximateStart: 2,
    approximateEnd: 2.6,
    confidence: 0.96,
    type: "untranscribed_voice",
  })],
});
assert.equal(approximateWithVad.autoRemoveRanges.length, 1);

for (const word of ["эээ", "эммм", "ммм", "ааа", "иии", "нууу", "воооот", "типааа", "корочеее", "значииит"]) {
  assert.equal(isFillerWord(word), true, `${word} should be treated as local filler fallback`);
}

assert.equal(isFillerWord("нормальное"), false);

function candidate(overrides: Partial<MelismCandidate>): MelismCandidate {
  return {
    id: "candidate-1",
    type: "elongated_hesitation",
    text: "эээ",
    beforeWordIndex: 0,
    afterWordIndex: 1,
    confidence: 0.9,
    action: "remove",
    reason: "test",
    ...overrides,
  };
}
