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
export type CleanupMode = "pauses_only" | "semantic_cleanup";
export type PresentationMode = "subtitles_only" | "subtitles_infographics" | "subtitles_infographics_media";
export type StylePreset = "clean_expert" | "dynamic_viral" | "premium_calm";
export type LanguageSetting = "auto" | "ru" | "en";
export type Aggressiveness = "low" | "medium" | "high";

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
