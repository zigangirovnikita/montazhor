/** Statuses that indicate work is already in progress. */
export const PROCESSING_STATUSES = [
  "extracting_audio",
  "transcribing",
  "planning",
  "rendering_clean_video",
  "rendering_preview",
  "rendering_final",
  "rendering_subtitles",
  "rendering_motion",
  "composing_final",
] as const;

export const PROCESSING_STATUS_SET = new Set<string>(PROCESSING_STATUSES);
