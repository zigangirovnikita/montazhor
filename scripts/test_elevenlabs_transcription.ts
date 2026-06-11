import assert from "node:assert/strict";
import { mapElevenLabsTranscript } from "@/server/ai/elevenLabsTranscription";

const transcript = mapElevenLabsTranscript({
  language_code: "rus",
  language_probability: 0.99,
  text: "яяя нууу короче вот так",
  audio_duration_secs: 10,
  words: [
    { text: "яяя", start: 1.2, end: 1.8, type: "word", speaker_id: "speaker_0", logprob: -0.1 },
    { text: " ", type: "spacing", logprob: 0 },
    { text: "нууу", start: 2.1, end: 2.7, type: "word", speaker_id: "speaker_0", logprob: -0.2 },
    { text: "(noise)", start: 2.9, end: 3.1, type: "audio_event", logprob: -0.4 },
    { text: "короче", start: 3.2, end: 3.7, type: "word", speaker_id: "speaker_0", logprob: -0.3 },
  ],
}, "ru");

assert.equal(transcript.provider, "elevenlabs");
assert.equal(transcript.language, "ru");
assert.equal(transcript.duration, 10);
assert.equal(transcript.segments.length, 1);
assert.equal(transcript.segments[0].words?.length, 3);
assert.equal(transcript.segments[0].words?.[0].word, "яяя");
assert.equal(transcript.segments[0].words?.[1].word, "нууу");
assert.equal(transcript.segments[0].words?.[2].speaker, "speaker_0");
assert.ok((transcript.segments[0].words?.[0].confidence ?? 0) > 0.9);
