export type VisualTemplateFamily =
  | "hook"
  | "stat"
  | "ratio"
  | "myth"
  | "compare"
  | "steps"
  | "quote"
  | "cta"
  | "dialogue"
  | "lesson";

export type VisualWeight = "micro" | "callout" | "medium" | "full";

export type VisualTemplateLayout =
  | "overlay_left"
  | "overlay_right"
  | "fullscreen"
  | "side_panel"
  | "lower_third";

export interface MotionTemplateSlot {
  name: string;
  type: "short_text" | "number" | "list" | "label";
  required: boolean;
  maxWords?: number;
  maxItems?: number;
}

export interface MotionTemplateDefinition {
  id: string; // e.g. "ais.golden_ratio_sidebar.v1"
  label: string;
  family: VisualTemplateFamily;
  visualWeight: VisualWeight;
  layout: VisualTemplateLayout;
  duration: {
    min: number;
    max: number;
    ideal: number;
  };
  slots: MotionTemplateSlot[];
  safeZones: {
    avoidFace: boolean;
    preferredArea: "left" | "right" | "top" | "bottom" | "full";
  };
  render: "hyperframes";
  component: string;
  version: string;
  compositingMode: "chroma_overlay" | "opaque_fullscreen" | "alpha_overlay";
}

export type VisualBeatIntent =
  | "hook"
  | "problem"
  | "mistake"
  | "correction"
  | "stat"
  | "comparison"
  | "steps"
  | "quote"
  | "cta"
  | "statement";

export interface VisualBeat {
  id: string;
  start: number;
  end: number;
  text: string;
  intent: VisualBeatIntent;
  importance: 1 | 2 | 3 | 4 | 5;
  entities: {
    numbers?: string[];
    before?: string;
    after?: string;
    wrong?: string;
    right?: string;
    steps?: string[];
  };
}

export interface TemplateInstance {
  id: string;
  start: number;
  duration: number;
  templateId: string;
  variantId: string;
  visualWeight: VisualWeight;
  slots: Record<string, unknown>;
  transitionIn: "fade" | "slide" | "zoom" | "wipe";
  transitionOut: "fade" | "cut";
}

export interface TemplateInstancePlan {
  stylePack: string;
  captionMode: "off" | "minimal" | "full";
  instances: TemplateInstance[];
  planner: "deterministic" | "ai";
  diagnostics?: string[];
}
