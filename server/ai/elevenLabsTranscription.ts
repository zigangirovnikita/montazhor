import { readFile } from "node:fs/promises";
import { fetch as undiciFetch, FormData as UndiciFormData, ProxyAgent } from "undici";
import type { TranscriptJson, TranscriptWord, TranscriptionInput, TranscriptionProvider } from "@/lib/types";

interface ElevenLabsWord {
  text?: unknown;
  start?: unknown;
  end?: unknown;
  type?: unknown;
  speaker_id?: unknown;
  logprob?: unknown;
}

interface ElevenLabsTranscript {
  language_code?: unknown;
  language_probability?: unknown;
  text?: unknown;
  words?: unknown;
  audio_duration_secs?: unknown;
}

export class ElevenLabsTranscriptionProvider implements TranscriptionProvider {
  async transcribe(input: TranscriptionInput): Promise<TranscriptJson> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY is not set.");
    }

    const proxyUrl = process.env.ELEVENLABS_PROXY_URL;
    const response = proxyUrl
      ? await undiciFetch(elevenLabsSpeechToTextUrl(), {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
        },
        body: await buildFormData(input, "undici"),
        dispatcher: new ProxyAgent(proxyUrl),
      } as unknown as Parameters<typeof undiciFetch>[1])
      : await fetch(elevenLabsSpeechToTextUrl(), {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
        },
        body: await buildFormData(input, "native") as BodyInit,
      });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "unknown error");
      throw new Error(`ElevenLabs STT returned ${response.status}: ${errorBody}`);
    }

    const data = (await response.json()) as ElevenLabsTranscript;
    return mapElevenLabsTranscript(data, input.language === "auto" ? "ru" : input.language);
  }
}

function elevenLabsSpeechToTextUrl(): string {
  return process.env.ELEVENLABS_STT_URL ?? "https://api.elevenlabs.io/v1/speech-to-text";
}

async function buildFormData(input: TranscriptionInput, implementation: "native" | "undici"): Promise<unknown> {
  const audioBuffer = await readFile(input.audioPath);
  const formData = implementation === "undici" ? new UndiciFormData() : new FormData();
  formData.append("model_id", process.env.ELEVENLABS_STT_MODEL ?? "scribe_v2");
  formData.append("file", new Blob([audioBuffer], { type: "audio/wav" }), "audio.wav");
  formData.append("language_code", input.language === "auto" ? "ru" : input.language);
  formData.append("timestamps_granularity", process.env.ELEVENLABS_TIMESTAMPS_GRANULARITY ?? "word");
  formData.append("diarize", process.env.ELEVENLABS_DIARIZE ?? "false");
  formData.append("tag_audio_events", process.env.ELEVENLABS_TAG_AUDIO_EVENTS ?? "true");
  formData.append("no_verbatim", process.env.ELEVENLABS_NO_VERBATIM ?? "false");
  return formData;
}

export function mapElevenLabsTranscript(data: ElevenLabsTranscript, fallbackLanguage: string): TranscriptJson {
  const words = parseWords(data.words);
  const start = words[0]?.start ?? 0;
  const end = words.at(-1)?.end ?? numberOr(data.audio_duration_secs, start);
  const text = typeof data.text === "string" ? data.text : words.map((word) => word.word).join(" ");

  return {
    provider: "elevenlabs",
    language: mapLanguage(data.language_code, fallbackLanguage),
    duration: numberOrUndefined(data.audio_duration_secs),
    segments: [{
      id: 0,
      start,
      end: Math.max(start, end),
      text,
      words,
    }],
  };
}

function parseWords(input: unknown): TranscriptWord[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item): TranscriptWord | undefined => {
      const word = item as ElevenLabsWord;
      if (word.type !== "word") return undefined;
      const text = typeof word.text === "string" ? word.text.trim() : "";
      const start = numberOrUndefined(word.start);
      const end = numberOrUndefined(word.end);
      if (!text || start === undefined || end === undefined || end <= start) return undefined;
      return {
        word: text,
        start,
        end,
        speaker: typeof word.speaker_id === "string" ? word.speaker_id : undefined,
        confidence: confidenceFromLogprob(word.logprob),
      };
    })
    .filter((word): word is TranscriptWord => Boolean(word));
}

function mapLanguage(value: unknown, fallback: string): string {
  if (value === "rus") return "ru";
  if (typeof value === "string" && value.length > 0) return value.slice(0, 2);
  return fallback;
}

function confidenceFromLogprob(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(1, Math.exp(value)));
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
