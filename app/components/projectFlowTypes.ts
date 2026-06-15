import type {
  CompiledScenePlan,
  PresentationMode,
  ScenePlan,
  SemanticBlock,
  StylePreset,
  TranscriptJson,
  VisualOverlayPlan
} from "@/lib/types";
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
    visualPlan?: VisualOverlayPlan | null;
    semanticBlocks?: SemanticBlock[] | null;
    scenePlan?: ScenePlan | null;
    compiledScenePlan?: CompiledScenePlan | null;
  } | null;
  originalUrl: string;
  cleanPreviewUrl: string | null;
  reviewUrl: string | null;
  downloadUrl: string | null;
}

export type DraftEditAction = "restore_removed_range" | "delete_range" | "delete_word" | "edit_word_text" | "apply_review_edits" | "reset_draft";

export interface DraftEditOperation {
  action: Exclude<DraftEditAction, "apply_review_edits" | "reset_draft">;
  sourceStart: number;
  sourceEnd: number;
  text?: string;
}

export interface DraftEditRequest {
  action: DraftEditAction;
  sourceStart?: number;
  sourceEnd?: number;
  text?: string;
  edits?: DraftEditOperation[];
}

export interface StyleState {
  presentationMode: PresentationMode;
  stylePreset: StylePreset;
  styleOptions: StyleDraftOptions;
}
