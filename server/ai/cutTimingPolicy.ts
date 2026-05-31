export const SCRIPT_KEEP_HANDLE_SECONDS = 0.3;
export const PAUSE_KEEP_HANDLE_SECONDS = 0.2;
export const WORD_GAP_REMOVAL_THRESHOLD = 0.4;
export const MIN_KEPT_FRAGMENT_SECONDS = 0.5;
export const SEMANTIC_EDGE_GUARD_SECONDS = 0.08;
export const FILLER_EDGE_GUARD_SECONDS = 0.35;
export const MAX_VAD_EDGE_PROTECTED_WORD_DURATION = 0.8;
export const CONSERVATIVE_TRANSCRIPT_GAP_FALLBACK_SECONDS = 1.0;
export const FILLER_MODE_UNTRANSCRIBED_VOICE_MIN_DURATION = 0.45;
export const SEMANTIC_MODE_UNTRANSCRIBED_VOICE_MIN_DURATION = 0.45;
export const MAIN_SPEAKER_BRIDGED_SPAN_MAX_DURATION = 1.6;

export const MIN_RELIABLE_WORD_DURATION = 0.04;
export const MAX_RELIABLE_WORD_DURATION = 1.5;
export const MAX_RELIABLE_FILLER_DURATION = 4;

export function isElongatedHesitationToken(text: string): boolean {
  const normalized = text.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "");
  if (!normalized) return false;

  return (
    /^э{2,}$/.test(normalized) ||
    /^е{2,}$/.test(normalized) ||
    /^м{2,}$/.test(normalized) ||
    /^а{2,}$/.test(normalized) ||
    /^у{2,}$/.test(normalized) ||
    /^ну{2,}$/.test(normalized) ||
    /^нуу+$/.test(normalized) ||
    /^эм+$/.test(normalized) ||
    /^мэ{2,}$/.test(normalized) ||
    /^бэ+$/.test(normalized) ||
    /^бэ{2,}$/.test(normalized) ||
    /^бе{2,}$/.test(normalized) ||
    /^мм?э{2,}$/.test(normalized) ||
    /^б+э{2,}$/.test(normalized)
  );
}
