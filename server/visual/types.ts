import type { StylePreset } from "@/lib/types";

export interface RemappedWord {
  id: string;
  text: string;
  sourceStart: number;
  sourceEnd: number;
  outputStart: number;
  outputEnd: number;
}

export interface RemappedTranscript {
  language: string;
  durationOutput: number;
  words: RemappedWord[];
}

export interface OutputRange {
  outputStart: number;
  outputEnd: number;
}

export interface Phrase {
  id: string;
  outputStart: number;
  outputEnd: number;
  text: string;
  wordIds: string[];
  sourceSpans: { sourceStart: number; sourceEnd: number }[];
}

export type SemanticIntent =
  | "title"
  | "list_title"
  | "step"
  | "rule"
  | "warning"
  | "mistake"
  | "do_dont"
  | "shortcut"
  | "tool"
  | "number_fact"
  | "comparison"
  | "before_after"
  | "benefit"
  | "definition"
  | "example"
  | "cta"
  | "plain_explanation";

export interface SemanticAnalysis {
  phraseId: string;
  intent: SemanticIntent;
  confidence: number;
  entities?: Record<string, any>;
}

export interface VisualLayer {
  id: string;
  phraseId?: string;
  component: string;
  outputStart: number;
  outputEnd: number;
  zIndex: number;
  timing: {
    anchor: string;
    mustCoverPhrase?: boolean;
    enterDuration?: number;
    exitDuration?: number;
  };
  props: Record<string, any>;
}

export interface SemanticVisualPlan {
  stylePackId: StylePreset;
  duration: number;
  layers: VisualLayer[];
}

export interface TimingWarning {
  layerId?: string;
  type: string;
  message: string;
}

export interface TimingReport {
  ok: boolean;
  warnings: TimingWarning[];
}
