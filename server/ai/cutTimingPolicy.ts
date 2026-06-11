export const SCRIPT_KEEP_HANDLE_SECONDS = 0.3;
export const PAUSE_KEEP_HANDLE_SECONDS = 0.2;
export const WORD_GAP_REMOVAL_THRESHOLD = 0.3;
export const MIN_KEPT_FRAGMENT_SECONDS = 0.5;
export const SEMANTIC_EDGE_GUARD_SECONDS = 0.08;
export const FILLER_EDGE_GUARD_SECONDS = 0.35;
export const MAX_VAD_EDGE_PROTECTED_WORD_DURATION = 0.8;
export const CONSERVATIVE_TRANSCRIPT_GAP_FALLBACK_SECONDS = 1.0;
export const FILLER_MODE_UNTRANSCRIBED_VOICE_MIN_DURATION = 0.3;
export const SEMANTIC_MODE_UNTRANSCRIBED_VOICE_MIN_DURATION = 0.3;
export const MAIN_SPEAKER_BRIDGED_SPAN_MAX_DURATION = 1.6;

export const MIN_RELIABLE_WORD_DURATION = 0.04;
export const MAX_RELIABLE_WORD_DURATION = 1.5;
export const MAX_RELIABLE_FILLER_DURATION = 4;

export const MELISM_MIN_CONFIDENCE_AUTO_REMOVE = numberEnv("MELISM_MIN_CONFIDENCE_AUTO_REMOVE", 0.75);
export const MELISM_MIN_CONFIDENCE_REVIEW = numberEnv("MELISM_MIN_CONFIDENCE_REVIEW", 0.45);
export const MIN_MELISM_REMOVAL_SECONDS = numberEnv("MIN_MELISM_REMOVAL_SECONDS", 0.15);
export const MAX_MELISM_REMOVAL_SECONDS = numberEnv("MAX_MELISM_REMOVAL_SECONDS", 2.0);
export const MELISM_KEEP_HANDLE_SECONDS = numberEnv("MELISM_KEEP_HANDLE_SECONDS", 0.08);
export const UNTRANSCRIBED_VOICE_REQUIRES_GEMINI = booleanEnv("UNTRANSCRIBED_VOICE_REQUIRES_GEMINI", true);
export const GEMINI_MELISM_DETECTOR_ENABLED = booleanEnv("GEMINI_MELISM_DETECTOR_ENABLED", true);

export function isElongatedHesitationToken(text: string): boolean {
  const normalized = text.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "");
  if (!normalized) return false;

  return (
    /^э{2,}$/.test(normalized) ||
    /^е{2,}$/.test(normalized) ||
    /^м{2,}$/.test(normalized) ||
    /^а{2,}$/.test(normalized) ||
    /^и{2,}$/.test(normalized) ||
    /^я{2,}$/.test(normalized) ||
    /^у{2,}$/.test(normalized) ||
    /^ну{2,}$/.test(normalized) ||
    /^нуу+$/.test(normalized) ||
    /^эм+$/.test(normalized) ||
    /^мэ{2,}$/.test(normalized) ||
    /^бэ+$/.test(normalized) ||
    /^бэ{2,}$/.test(normalized) ||
    /^бе{2,}$/.test(normalized) ||
    /^мм?э{2,}$/.test(normalized) ||
    /^б+э{2,}$/.test(normalized) ||
    /^во+т+$/.test(normalized) ||
    /^типа+$/.test(normalized) ||
    /^короче+$/.test(normalized) ||
    /^значи+т+$/.test(normalized)
  );
}

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function booleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}
