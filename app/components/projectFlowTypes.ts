import type { PresentationMode, StylePreset, TranscriptJson } from "@/lib/types";
import type { StyleDraftOptions } from "@/app/components/PresentationConfigurator";

export interface ProjectPayload {
  project: {
    id: string;
    status: string;
    originalFilename: string;
    cleanupMode?: string | null;
    presentationMode?: string | null;
    stylePreset?: string | null;
    styleOptionsJson?: string | null;
    errorMessage?: string | null;
    logs: Array<{ id: string; level: string; message: string; createdAt: string }>;
  };
  draft?: {
    transcript?: TranscriptJson;
    edl?: {
      removedRanges: Array<{ sourceStart: number; sourceEnd: number; reason: string; text?: string }>;
      keptRanges?: Array<{ sourceStart: number; sourceEnd: number; reason: string; text?: string }>;
    };
    subtitles?: Array<{ id: string; start: number; end: number; text: string }>;
    contentPlan?: { hook: string; description: string; hashtags: string[] };
  } | null;
  originalUrl: string;
  cleanPreviewUrl: string | null;
  reviewUrl: string | null;
  downloadUrl: string | null;
}

export type DraftEditAction = "restore_removed_range" | "delete_range" | "delete_word" | "reset_draft";

export interface DraftEditRequest {
  action: DraftEditAction;
  sourceStart?: number;
  sourceEnd?: number;
}

export interface StyleState {
  presentationMode: PresentationMode;
  stylePreset: StylePreset;
  styleOptions: StyleDraftOptions;
}
