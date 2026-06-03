export type ProjectStatus =
  | "uploaded"
  | "extracting_audio"
  | "transcribing"
  | "planning"
  | "draft_ready"
  | "rendering_clean_video"
  | "rendering_preview"
  | "review_ready"
  | "rendering_final"
  | "done"
  | "error";

export type Platform = "instagram_reels" | "tiktok" | "youtube_shorts";
export type EditMode = "cut_subtitles" | "cut_subtitles_infographics";
export type CleanupMode = "pauses_only" | "pauses_and_fillers" | "semantic_cleanup";
export type PresentationMode = "subtitles_only" | "subtitles_infographics" | "subtitles_infographics_media";
export type StylePreset =
  | "clean_expert"
  | "dynamic_viral"
  | "premium_calm"
  | "course_glass"
  | "expert_clean"
  | "viral_kinetic";
export type LanguageSetting = "auto" | "ru" | "en";
export type VisualDensity = "low" | "medium" | "high";
export type MotionIntensity = "calm" | "medium" | "active";
export type VisualMomentType =
  | "number"
  | "list"
  | "warning"
  | "quote"
  | "comparison"
  | "definition"
  | "cta"
  | "keyword"
  | "chart";
export type VisualTemplateId =
  | "big_number"
  | "bullet_cards"
  | "keyword_slam"
  | "checklist"
  | "metric_chart"
  | "cta_plate";
export type VisualMotionId =
  | "glass_slide"
  | "word_slam"
  | "depth_zoom"
  | "chart_grow"
  | "soft_pop"
  | "calm_fade";
export type VisualLayout = "left" | "right" | "center" | "lower_third" | "full_frame";

export function resolveCleanupMode(cleanupMode?: string | null): CleanupMode {
  if (cleanupMode === "pauses_only" || cleanupMode === "pauses_and_fillers" || cleanupMode === "semantic_cleanup") {
    return cleanupMode;
  }
  return "semantic_cleanup";
}

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  speaker?: string;
  confidence?: number;
}

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  speaker?: string;
  words?: TranscriptWord[];
}

export interface TranscriptJson {
  language: string;
  segments: TranscriptSegment[];
  provider?: string;
  alignmentProvider?: string;
  diarizationProvider?: string;
  mainSpeakerId?: string;
  speakerRanges?: SpeakerSpeechRange[];
}

export interface SpeakerSpeechRange {
  start: number;
  end: number;
  speaker: string;
}

export interface EditRange {
  sourceStart: number;
  sourceEnd: number;
  reason: string;
  text?: string;
}

export interface EditDecisionList {
  keptRanges: EditRange[];
  removedRanges: EditRange[];
}

export interface KeepSegment {
  sourceStart: number;
  sourceEnd: number;
  text: string;
  role: "final_script";
  reason: string;
  confidence: number;
}

export interface RejectedTake {
  sourceStart: number;
  sourceEnd: number;
  text: string;
  reason: "earlier_duplicate" | "technical_chatter" | "abandoned_start" | "off_narrative" | "unsafe";
}

export interface ScriptSelectionPlan {
  reasoning: string;
  keepSegments: KeepSegment[];
  rejectedTakes: RejectedTake[];
}

export interface SubtitleDraft {
  id: string;
  start: number;
  end: number;
  text: string;
  words: TranscriptWord[];
  highlightedWords: string[];
}

export interface MotionInsert {
  id: string;
  type: "hook" | "key_point" | "cta";
  startTime: number;
  duration: number;
  text: string;
  renderPath?: string;
}

export interface ContentPlan {
  hook: string;
  keyPhrases: string[];
  titleSuggestions: string[];
  description: string;
  hashtags: string[];
  motionInserts: MotionInsert[];
}

export interface SemanticMoment {
  id: string;
  start: number;
  end: number;
  type: VisualMomentType;
  sourceText: string;
  importance: 1 | 2 | 3;
  reason: string;
}

export interface VisualBeat {
  id: string;
  start: number;
  duration: number;
  templateId: VisualTemplateId;
  motionId: VisualMotionId;
  layout: VisualLayout;
  payload: Record<string, unknown>;
  sourceMomentId?: string;
}

export interface VisualStyleProfile {
  id: StylePreset;
  label: string;
  density: VisualDensity;
  motionIntensity: MotionIntensity;
  typography: {
    heading: string;
    body: string;
    number: string;
  };
  colors: {
    background: string;
    surface: string;
    surfaceStrong: string;
    text: string;
    muted: string;
    accent: string;
    accent2: string;
    warning: string;
    border: string;
  };
  allowedTemplates: VisualTemplateId[];
  allowedMotions: VisualMotionId[];
}

export interface VisualTemplateDefinition {
  id: VisualTemplateId;
  label: string;
  momentTypes: VisualMomentType[];
  minDuration: number;
  maxDuration: number;
  allowedLayouts: VisualLayout[];
  requiredPayload: string[];
}

export interface VisualOverlayPlan {
  styleProfileId: StylePreset;
  density: VisualDensity;
  beats: VisualBeat[];
  fallbackSubtitleMode: "off" | "minimal" | "active_word";
  planner: "heuristic" | "ai";
}

export interface VisualPlanInput {
  transcript: TranscriptJson;
  edl: EditDecisionList;
  subtitles: SubtitleDraft[];
  contentPlan: ContentPlan;
  stylePreset: StylePreset;
  duration: number;
}

export interface DraftProposal {
  projectId: string;
  transcript: TranscriptJson;
  edl: EditDecisionList;
  subtitles: SubtitleDraft[];
  contentPlan: ContentPlan;
}

export interface TranscriptionInput {
  audioPath: string;
  language: LanguageSetting;
}

export interface TranscriptionProvider {
  transcribe(input: TranscriptionInput): Promise<TranscriptJson>;
}

export interface MotionRenderInput {
  projectId: string;
  projectDir: string;
  stylePreset: StylePreset;
  inserts: MotionInsert[];
}

export interface MotionRenderer {
  renderInserts(input: MotionRenderInput): Promise<MotionInsert[]>;
}

export interface ContentPlanInput {
  transcript: TranscriptJson;
  edl: EditDecisionList;
  platform: Platform;
  stylePreset: StylePreset;
}

export interface ContentPlanner {
  plan(input: ContentPlanInput): Promise<ContentPlan>;
}

export interface VoiceCommandInput {
  projectId: string;
  audioPath: string;
}

export interface VoiceCommandResult {
  transcriptText: string;
  applied: boolean;
  message: string;
}

export type AiUsageSource = "script_selector" | "hyperframes" | "content_planner";

export interface AiTokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedTokens?: number;
  cacheWriteTokens?: number;
  audioTokens?: number;
  cost?: number;
  upstreamCost?: number;
}

export interface AiCallResult {
  content: string;
  responseId?: string;
  model?: string;
  usage?: AiTokenUsage;
}
