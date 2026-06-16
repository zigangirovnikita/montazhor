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
export type PresentationMode = "subtitles_only" | "subtitles_infographics" | "subtitles_infographics_media" | "cinematic_scenes";
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
  | "chart"
  | "kinetic_text";
export type VisualTemplateId =
  | "big_number"
  | "bullet_cards"
  | "keyword_slam"
  | "checklist"
  | "metric_chart"
  | "lesson_title"
  | "myth_strike"
  | "stat_panel"
  | "concept_map"
  | "cta_plate"
  | "kinetic_text";
export type VisualMotionId =
  | "glass_slide"
  | "word_slam"
  | "depth_zoom"
  | "chart_grow"
  | "soft_pop"
  | "calm_fade";
export type VisualLayout = "left" | "right" | "center" | "lower_third" | "full_frame";
export type VisualPresetPack = "balanced" | "premium" | "viral" | "educational" | "minimal";
export type VisualSafeRegionKind = "face" | "speaker" | "subtitle_block";

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
  duration?: number;
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
  words?: TranscriptWord[];
  importance: 1 | 2 | 3;
  reason: string;
}

export interface VisualBeat {
  id: string;
  start: number;
  duration: number;
  templateId: VisualTemplateId;
  presetId?: string;
  motionId: VisualMotionId;
  motionOutId?: string;
  layout: VisualLayout;
  payload: Record<string, unknown>;
  sourceMomentId?: string;
  role?: "speech_text" | "semantic_accent" | "cta";
  variant?: "compact" | "standard" | "hero" | "safe";
  styleOverrides?: {
    surface?: string | null;
    surfaceOpacity?: number;
    borderRadius?: number;
    padding?: number;
    colorText?: string | null;
    colorBackground?: string | null;
    colorAccent?: string | null;
    borderColor?: string | null;
    shadow?: string | null;
  };
}

export interface VisualSafeRegion {
  id?: string;
  kind?: VisualSafeRegionKind;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
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

export interface VisualPresetDefinition {
  id: string;
  label: string;
  pack: VisualPresetPack;
  templateId: VisualTemplateId;
  momentTypes: VisualMomentType[];
  preferredLayouts: VisualLayout[];
  variants: Array<NonNullable<VisualBeat["variant"]>>;
  maxTextChars: number;
  maxItems?: number;
  fallbackPresetId: string;
}

export interface VisualOverlayPlan {
  styleProfileId: StylePreset;
  density: VisualDensity;
  beats: VisualBeat[];
  fallbackSubtitleMode: "off" | "minimal" | "active_word";
  planner: "heuristic" | "ai" | "continuous";
  diagnostics?: string[];
}

export type VisualSceneType =
  | "lesson_title"
  | "ratio_stack"
  | "myth_strike"
  | "stat_hud"
  | "trust_map"
  | "pip_slide"
  | "three_cards"
  | "warning_dialogue"
  | "compare_split"
  | "timeline_steps"
  | "quote_focus"
  | "cta_plate";

export type VisualSceneLayoutMode = "overlay" | "full_frame" | "pip" | "split";

export interface VisualScene {
  id: string;
  start: number;
  duration: number;
  sceneType: VisualSceneType;
  presetId: string;
  layoutMode: VisualSceneLayoutMode;
  speakerMode?: SpeakerMode;
  sourceText: string;
  payload: Record<string, unknown>;
  safeRegionPolicy: "avoid_speaker" | "full_frame" | "pip_safe";
  transitionIn: "fade" | "slide" | "zoom";
  transitionOut: "fade" | "slide" | "cut";
}

export interface VisualScenePlan {
  styleProfileId: StylePreset;
  scenes: VisualScene[];
  planner: "deterministic" | "ai";
  diagnostics?: string[];
}

export interface VisualPlanOptions {
  visualDensity?: VisualDensity;
  motionIntensity?: MotionIntensity;
  presetPack?: VisualPresetPack;
  disabledTemplates?: VisualTemplateId[];
  faceSafeRegions?: VisualSafeRegion[];
  visualTemplateId?: string;
  visualTemplate?: unknown;
}

export type SemanticBlockType =
  | "hook"
  | "thesis"
  | "explanation"
  | "definition"
  | "example"
  | "comparison"
  | "myth_vs_truth"
  | "proof"
  | "timeline"
  | "list"
  | "warning"
  | "cta"
  | "transition";

export type SceneCategory =
  | "overlay_scene"
  | "split_scene"
  | "pip_scene"
  | "full_graphic_scene"
  | "camera_emphasis_scene"
  | "transition_scene";

export type SceneRecipeId =
  | "hook_title_left"
  | "hook_title_center"
  | "headline_with_accent_number"
  | "step_number_callout"
  | "before_after_phrase_swap"
  | "rule_card"
  | "list_progression"
  | "big_number_grow"
  | "big_number_plus_text_plate"
  | "warning_strike_fix"
  | "hotkey_command_tip"
  | "myth_vs_truth"
  | "definition_card"
  | "comparison_split"
  | "checklist_reveal"
  | "timeline_year_callout"
  | "trust_diagram"
  | "quote_emphasis"
  | "cta_finish"
  | "speaker_lower_half_top_visual"
  | "speaker_right_panel_left_infographic"
  | "voiceover_full_graphic"
  | "camera_punch_in"
  | "clean_section_transition";

export type SpeakerMode = "full_frame" | "reframed" | "pip" | "hidden";
export type SceneIntensity = "safe" | "balanced" | "strong";
export type SceneTransition = "fade" | "slide" | "zoom" | "wipe" | "cut";
export type PlanningConfidenceLevel = "high" | "medium" | "low";
export type PlanningEscalationPolicy = "none" | "enhanced_ai" | "review_queue";
export type ScenePriority = "hero" | "support" | "ambient" | "skip";
export type SceneDensity = "minimal" | "balanced" | "dense";
export type CopyCompressionMode = "headline" | "labelled" | "bullet" | "contrast" | "cta";
export type VisualRole = "hero_scene" | "support_overlay" | "micro_emphasis" | "transition_scene" | "none";
export type HoldStrategy = "readable_hold" | "carry_with_microbeats" | "quick_punctuate" | "transition_bridge";
export type MicroBeatType =
  | "number_emphasis"
  | "keyword_highlight"
  | "chart_tick"
  | "label_reveal"
  | "checklist_row"
  | "strike_through"
  | "subtitle_emphasis"
  | "panel_state_change"
  | "camera_push"
  | "icon_pop"
  | "background_shift";
export type SceneLayerKind =
  | "speaker"
  | "title"
  | "subtitle"
  | "number"
  | "checklist"
  | "comparison"
  | "chart"
  | "quote"
  | "cta"
  | "transition"
  | "supporting_text";

export interface SemanticBlock {
  id: string;
  type: SemanticBlockType;
  start: number;
  end: number;
  text: string;
  summary: string;
  words: TranscriptWord[];
  transcriptWordRange: {
    startIndex: number;
    endIndex: number;
  };
  wordCount: number;
  contextBefore?: string;
  contextAfter?: string;
}

export interface PlanningConfidence {
  level: PlanningConfidenceLevel;
  score: number;
  reasons: string[];
  escalationPolicy: PlanningEscalationPolicy;
}

export interface ScreenCopyPayload {
  title?: string;
  subtitle?: string;
  text?: string;
  left?: string;
  right?: string;
  items?: string[];
  label?: string;
  cta?: string;
  value?: string;
  caption?: string;
  falseText?: string;
  trueText?: string;
  quote?: string;
  center?: string;
  slots?: SemanticSlot[];
  supportVisuals?: SupportVisualIntent[];
  layerActions?: LayerActionBeat[];
}

export type SemanticSlotRole =
  | "headline"
  | "hero_number"
  | "step_index"
  | "step_label"
  | "wrong_phrase"
  | "correct_phrase"
  | "command_hotkey"
  | "keyword_accent"
  | "supporting_context"
  | "cta_phrase"
  | "comparison_left"
  | "comparison_right"
  | "quote_pull";

export type SemanticSlotStyle = "accent" | "primary" | "muted" | "success" | "danger" | "chip";

export type SupportVisualKind =
  | "cursor"
  | "mouse"
  | "keyboard"
  | "hotkey_keys"
  | "warning_mark"
  | "number_badge"
  | "checkmark"
  | "timeline_tick"
  | "chart_pulse";

export type LayerActionType =
  | "show_layer"
  | "hide_layer"
  | "highlight_slot"
  | "strike_slot"
  | "swap_to_correct"
  | "grow_number"
  | "reveal_step"
  | "show_hotkey"
  | "pop_support_visual"
  | "camera_push";

export interface SemanticSlot {
  id: string;
  role: SemanticSlotRole;
  text: string;
  shortText?: string;
  style: SemanticSlotStyle;
  start: number;
  end: number;
  wordRange?: {
    startIndex: number;
    endIndex: number;
  };
}

export interface SupportVisualIntent {
  id: string;
  kind: SupportVisualKind;
  start: number;
  end: number;
  label?: string;
  anchorSlotId?: string;
}

export interface LayerActionBeat {
  id: string;
  type: LayerActionType;
  start: number;
  end: number;
  targetLayerId?: string;
  targetSlotId?: string;
  supportVisualId?: string;
  payload?: Record<string, unknown>;
}

export interface DirectorPlanBlock {
  id: string;
  blockId: string;
  blockType: SemanticBlockType;
  sceneCategory: SceneCategory;
  recipeId: SceneRecipeId;
  variantId?: string;
  speakerMode: SpeakerMode;
  intensity: SceneIntensity;
  scenePriority: ScenePriority;
  sceneDensity: SceneDensity;
  visualRole: VisualRole;
  holdStrategy: HoldStrategy;
  transitionIn: SceneTransition;
  transitionOut: SceneTransition;
  start: number;
  end: number;
  rationale?: string;
  fallbackRecipeId?: SceneRecipeId;
  safeMode?: boolean;
  disabled?: boolean;
  allowedRecipeIds?: SceneRecipeId[];
  recommendedRecipeId?: SceneRecipeId;
  planningConfidence: PlanningConfidence;
}

export interface DirectorPlan {
  version: string;
  templateId?: string;
  templateName?: string;
  styleProfileId: StylePreset;
  planner: "deterministic" | "ai";
  semanticBlocks: SemanticBlock[];
  blocks: DirectorPlanBlock[];
  diagnostics?: string[];
}

export interface ScreenCopyBlock {
  id: string;
  blockId: string;
  recipeId: SceneRecipeId;
  copyCompressionMode: CopyCompressionMode;
  payload: ScreenCopyPayload;
  editableFields: Array<keyof ScreenCopyPayload>;
  planningConfidence: PlanningConfidence;
  rationale?: string;
}

export interface ScreenCopyPlan {
  version: string;
  templateId?: string;
  styleProfileId: StylePreset;
  planner: "deterministic" | "ai";
  blocks: ScreenCopyBlock[];
  diagnostics?: string[];
}

export interface SceneLayerPlan {
  id: string;
  kind: SceneLayerKind;
  emphasis?: "support" | "primary" | "dominant";
  enabled: boolean;
  payload: Record<string, unknown>;
}

export interface SceneMicroBeat {
  id: string;
  type: MicroBeatType;
  start: number;
  end: number;
  anchorText?: string;
  anchorWordRange?: {
    startIndex: number;
    endIndex: number;
  };
  payload?: Record<string, unknown>;
}

export interface ScenePlanBlock {
  id: string;
  blockId: string;
  blockType: SemanticBlockType;
  sceneCategory: SceneCategory;
  recipeId: SceneRecipeId;
  variantId?: string;
  speakerMode: SpeakerMode;
  layerPlan: SceneLayerPlan[];
  microBeats: SceneMicroBeat[];
  intensity: SceneIntensity;
  transitionIn: SceneTransition;
  transitionOut: SceneTransition;
  start: number;
  end: number;
  rationale?: string;
  fallbackRecipeId?: SceneRecipeId;
  safeMode?: boolean;
  allowedRecipeIds?: SceneRecipeId[];
  recommendedRecipeId?: SceneRecipeId;
  planningConfidence?: PlanningConfidence;
  scenePriority?: ScenePriority;
  sceneDensity?: SceneDensity;
  visualRole?: VisualRole;
  holdStrategy?: HoldStrategy;
}

export interface ScenePlan {
  version: string;
  templateId?: string;
  templateName?: string;
  styleProfileId: StylePreset;
  planner: "deterministic" | "ai";
  semanticBlocks: SemanticBlock[];
  blocks: ScenePlanBlock[];
  diagnostics?: string[];
}

export interface CompiledSceneBlock {
  id: string;
  blockId: string;
  sceneId: string;
  blockType: SemanticBlockType;
  sceneCategory: SceneCategory;
  recipeId: SceneRecipeId;
  speakerMode: SpeakerMode;
  start: number;
  end: number;
  duration: number;
  renderPath: "overlay" | "full_scene";
  activeLayerIds: string[];
  summary: string;
  screenCopy: ScreenCopyPayload;
  overlayBeats: VisualBeat[];
  fullScene?: VisualScene;
  microBeats: SceneMicroBeat[];
  fallbackApplied?: boolean;
  planningConfidence?: PlanningConfidence;
  scenePriority?: ScenePriority;
  sceneDensity?: SceneDensity;
  visualRole?: VisualRole;
  holdStrategy?: HoldStrategy;
}

export interface CompiledScenePlan {
  version: string;
  templateId?: string;
  styleProfileId: StylePreset;
  planner: "deterministic" | "ai";
  blocks: CompiledSceneBlock[];
  diagnostics?: string[];
}

export interface VisualFrameProfile {
  orientation: "portrait" | "landscape";
  width: number;
  height: number;
}

export interface VisualPlanInput {
  transcript: TranscriptJson;
  edl: EditDecisionList;
  subtitles: SubtitleDraft[];
  contentPlan: ContentPlan;
  stylePreset: StylePreset;
  duration: number;
  frame?: VisualFrameProfile;
  styleOptions?: VisualPlanOptions;
}

export type SemanticRole = 
  | "statement" | "emphasis" | "number" | "list_item" 
  | "warning" | "question" | "cta" | "connector" | "definition" | "comparison" | "chart";

export interface VisualPhrase {
  id: string;
  start: number;
  end: number;
  text: string;
  words: TranscriptWord[];
  semanticRole: SemanticRole;
  emphasisWords: string[];
  density: "sparse" | "normal" | "dense";
  containsNumber: boolean;
  containsList: boolean;
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
  projectId?: string;
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
