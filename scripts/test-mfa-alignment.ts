import assert from "node:assert/strict";
import type { TranscriptJson } from "../lib/types";
import { detectSuspiciousMfaSegments, mergeMfaAlignedWords } from "../server/ai/mfaAlignment";

const transcript: TranscriptJson = {
  language: "ru",
  segments: [
    {
      id: 0,
      start: 0.537,
      end: 10.181,
      text: "Всем привет, сегодня хочу рассказать одну очень интересную историю про то, как я, ну, побывал в Америке.",
      words: [
        { word: "Всем", start: 0.537, end: 0.823, confidence: 0.92 },
        { word: "привет,", start: 0.852, end: 1.292, confidence: 0.92 },
        { word: "сегодня", start: 1.292, end: 1.773, confidence: 0.93 },
        { word: "хочу", start: 1.773, end: 2.173, confidence: 0.93 },
        { word: "рассказать", start: 2.173, end: 2.634, confidence: 0.94 },
        { word: "одну", start: 2.634, end: 3.034, confidence: 0.92 },
        { word: "очень", start: 3.034, end: 3.434, confidence: 0.95 },
        { word: "интересную", start: 3.434, end: 3.514, confidence: 0.31 },
        { word: "историю", start: 3.514, end: 3.615, confidence: 0.35 },
        { word: "про", start: 3.615, end: 3.795, confidence: 0.9 },
        { word: "то,", start: 3.795, end: 3.995, confidence: 0.91 },
        { word: "как", start: 4.823, end: 5.037, confidence: 0.88 },
        { word: "я,", start: 5.037, end: 5.228, confidence: 0.89 },
        { word: "ну,", start: 5.228, end: 5.548, confidence: 0.91 },
        { word: "побывал", start: 8.58, end: 8.96, confidence: 0.84 },
        { word: "в", start: 8.96, end: 9.06, confidence: 0.84 },
        { word: "Америке.", start: 9.06, end: 10.181, confidence: 0.86 },
      ],
    },
  ],
};

async function main() {
  const suspicious = detectSuspiciousMfaSegments(transcript);
  assert.equal(suspicious.length, 1, "large internal gaps and low confidence should mark the segment as suspicious");
  assert.equal(suspicious[0].segmentIndex, 0);

  const merged = mergeMfaAlignedWords(transcript.segments[0], [
    { word: "всем", start: 0.0, end: 0.26 },
    { word: "привет", start: 0.26, end: 0.64 },
    { word: "сегодня", start: 0.64, end: 0.96 },
    { word: "хочу", start: 0.96, end: 1.21 },
    { word: "рассказать", start: 1.21, end: 1.65 },
    { word: "одну", start: 1.65, end: 1.83 },
    { word: "очень", start: 1.83, end: 2.09 },
    { word: "интересную", start: 2.09, end: 2.53 },
    { word: "историю", start: 2.53, end: 2.86 },
    { word: "про", start: 2.86, end: 3.01 },
    { word: "то", start: 3.01, end: 3.17 },
    { word: "как", start: 3.17, end: 3.49 },
    { word: "я", start: 3.49, end: 3.79 },
    { word: "ну", start: 4.36, end: 4.67 },
    { word: "побывал", start: 8.01, end: 8.42 },
    { word: "в", start: 8.42, end: 8.48 },
    { word: "америке", start: 8.48, end: 8.92 },
  ]);

  assert(merged, "matching normalized token sequence should merge MFA timings back into the segment");
  assert.equal(merged?.words?.[7].word, "интересную");
  assert.equal(merged?.words?.[7].start, 2.09);
  assert.equal(merged?.words?.at(-1)?.end, 8.92);

  console.log("mfa alignment tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
