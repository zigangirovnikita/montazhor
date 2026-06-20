import type { EditMode, PresentationMode } from "@/lib/types";

export const CANONICAL_PRESENTATION_MODE: PresentationMode = "subtitles_only";
export const SUPPORTED_PRESENTATION_MODES = new Set<PresentationMode>([CANONICAL_PRESENTATION_MODE]);

export function normalizePresentationMode(_unused: string | null | undefined): PresentationMode {
  void _unused;
  return CANONICAL_PRESENTATION_MODE;
}

export function isSupportedPresentationMode(value: string): value is PresentationMode {
  return SUPPORTED_PRESENTATION_MODES.has(value as PresentationMode);
}

export function editModeForPresentationMode(_unused: PresentationMode): EditMode {
  void _unused;
  return "cut_subtitles";
}
