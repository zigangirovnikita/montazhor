# AGENTS.md

## Project

This is an AI autopilot for short-form talking-head videos.

## Deployment Environment

Production and active development now run on the remote server, not on the local Mac.

Rules:

* Treat the server as the primary runtime and source of truth for deployment validation.
* Do not assume local Mac-only paths, caches, Python envs, or binaries are representative of production.
* When verifying real processing, startup, rendering, model loading, or deploy behavior, prefer checking the server environment.
* Keep deployment configs aligned with the native server layout under `/opt/montazhor`.

Current server target:

* host: `45.147.177.53`
* ssh user: `root`
* local SSH env source: `.env.server-access`
* app path: `/opt/montazhor`
* systemd service: `montazhor.service`
* active git branch: `feature/template-builder`

Current production build as of 2026-06-12:

* Runtime is the remote server under `/opt/montazhor`; GitHub remote is `origin` at `https://github.com/zigangirovnikita/montazhor.git`.
* Production transcription provider is `ElevenLabsTranscriptionProvider`, enabled with `TRANSCRIPTION_PROVIDER="elevenlabs"`.
* ElevenLabs traffic goes through a server-local Xray HTTP proxy at `ELEVENLABS_PROXY_URL="http://127.0.0.1:10809"` because direct server traffic to ElevenLabs can be region-blocked.
* `xray` must be active together with `montazhor.service`; verify both with `systemctl is-active xray` and `systemctl is-active montazhor.service`.
* ElevenLabs uses `scribe_v2` with word timestamps. Keep `ELEVENLABS_TIMESTAMPS_GRANULARITY="word"`.
* Gemini melism detection is currently disabled in production with `GEMINI_MELISM_DETECTOR_ENABLED="false"`. Keep Gemini code available, but do not assume it runs in the default build.
* Parakeet has been removed from the architecture. Do not reintroduce Parakeet through OpenRouter for word timestamps unless a provider with real word-level timings is verified first.
* Voice activity/diarization still uses `VOICE_ACTIVITY_PROVIDER="pyannote"` with Silero/VAD fallback logic in the app.
* MFA alignment remains optional and environment-controlled. It must not replace ElevenLabs word text or the VAD/diarization source of truth.
* Current verified melism test audio produced an end-to-end `draft_ready` project with ElevenLabs timestamps, removed `а-а-а`, `э-э-э`, `Иии`, `яяя`, and `нууу`, and preserved the meaningful phrase `короче вот так`.

Secrets rule:

* Do not store server passwords, API keys, or private credentials in `AGENTS.md`, tracked docs, or committed `.env` files.
* Keep secrets only in untracked local env files, a password manager, or the live server environment.
* If SSH access is needed for the production server, read host/user/password from the local untracked `.env.server-access` file.

The product is not a traditional video editor and not a CapCut clone.

Core user flow:

Raw talking-head video → automatic cleanup → continuous semantic visual text layer → final publish-ready MP4 in the source-oriented Full HD profile.

The user should not need to manually edit a timeline.

## Product Principles

- Default UX: upload video → process automatically → preview → download.
- Optimize for talking-head videos first.
- Prefer a simple publish-ready result over many editing controls.
- Do not build a full timeline editor unless explicitly asked.
- Keep cutting conservative: do not remove words or pauses if it may break meaning or produce an unnatural jump.
- If optional visual effects fail, still produce a usable final video.
- Taste matters: avoid cheap, noisy, random AI-looking effects.
- Separate three phases conceptually and architecturally: speech cleanup, presentation styling, and final export.
- Do not force the user to choose subtitle/infographic styling before the cleanup draft exists.
- Prefer preset-based styling and review loops over exposing many low-level visual controls.
- Main review UX is text-first + preview-first, not timeline-first.
- Timeline or boundary controls are secondary "Точная настройка" tools for advanced users only.

## Mobile Review UX Rules

- Optimize the main flow for smartphone users first.
- The main route is: upload → choose what to remove (`pauses_only`, `pauses_and_fillers`, or `semantic_cleanup`) → processing → draft review through one video player + transcript text → optional precise tuning → style presets → final preview → export.
- Draft review must use one player with a `До / После` switch, not two simultaneous videos on mobile.
- Transcript review is the primary editing surface. Show kept words normally and removed ranges as red/strikethrough text.
- Draft transcript review may use a horizontally scrollable word ticker under the player as the main text review surface on mobile, as long as it remains text-first and preview-first rather than timeline-first.
- Show even very short technical pause removals (`vad_pause`, `pause`, gap ranges) as separate red/strikethrough fragments in transcript review, so the user can understand every edit.
- Show review-only candidate fragments for suspicious but not-yet-removed pauses, voice-like gaps, and filler words as selectable text controls. Candidate fragments must be actionable through explicit confirmation, not decorative labels.
- Do not mark a whole word as removed only because a short technical pause overlaps part of that word's timestamp. A word should be shown as removed only when the removed range covers a meaningful share of the word or the removal is semantic/textual.
- Tapping a word or removed fragment must only select it and show available actions. It must not immediately mutate the EDL or start re-rendering.
- User edits must be confirmed explicitly through an action such as `Удалить и перемонтировать`, `Вернуть`, or another clear apply button.
- Multiple transcript edits on the draft review screen should accumulate locally and be applied in one explicit batch action; do not trigger a clean-video re-render after every single word tap.
- Multi-word selection should be supported before applying a delete/remount action.
- Any EDL-changing text action must re-render `clean.mp4` and invalidate old review/final artifacts before the user continues.
- When the user manually scrubs the review word ticker, the word under the visual center marker becomes the temporary source of truth for preview position while playback is paused.
- Pressing play after manual word-ticker scrubbing must start playback from the beginning of the centered word, not from an older player time.
- Keep low-level style controls behind `Настроить стиль`; the default style screen should be preset and toggle based.

## MVP Scope

Build the smallest working end-to-end prototype:

1. Upload `mp4`, `mov`, or `webm`.
2. Save original video locally.
3. Extract audio with FFmpeg.
4. Transcribe with the active provider. Production currently uses ElevenLabs `scribe_v2` with word timestamps through the local Xray proxy; local Whisper/stable-ts remains a fallback provider.
5. Generate transcript JSON.
6. Detect long pauses and obvious filler words.
7. Create an edit decision list.
8. Render a clean cut with FFmpeg.
9. Normalize uploaded video to a Full HD source-oriented profile:
   * portrait input -> `1080x1920`
   * landscape input -> `1920x1080`
10. Generate readable burned-in subtitles.
11. Generate a continuous HyperFrames semantic visual text layer with contextual preset inserts.
12. Compose final MP4.
13. Show preview, download button, transcript, EDL, and logs.

Do not implement auth, billing, social publishing, mobile app, team workspaces, or a full editor in the MVP.

## Tech Stack

Use this stack unless instructed otherwise:

- Next.js
- React
- TypeScript
- Prisma
- SQLite
- Local filesystem storage
- FFmpeg
- ElevenLabs Speech-to-Text as the current production transcription provider
- Local Whisper/stable-ts as fallback transcription provider
- Xray local HTTP proxy for ElevenLabs server egress
- Pyannote/Silero VAD for voice activity detection and diarization fallback
- HyperFrames for continuous semantic visual overlays
- ASS subtitles burned with FFmpeg
- `pnpm`

Avoid adding heavy infrastructure before the local MVP works.

## Suggested Structure

/app
  /page.tsx
  /project/[id]/page.tsx
  /api/projects/upload/route.ts
  /api/projects/[id]/process/route.ts
  /api/projects/[id]/draft-edits/route.ts
  /api/projects/[id]/render/route.ts
  /api/projects/[id]/finalize/route.ts
  /api/projects/[id]/route.ts
  /api/projects/[id]/clean/route.ts
  /api/projects/[id]/review/route.ts
  /api/projects/[id]/original/route.ts
  /api/projects/[id]/download/route.ts
  /api/projects/[id]/logs/route.ts
  /api/projects/[id]/transcript/route.ts
  /api/projects/[id]/edl/route.ts
  /api/projects/[id]/voice/route.ts

/lib
  /db.ts
  /storage.ts
  /logger.ts
  /config.ts
  /jobs.ts

/server/video
  /ffmpeg.ts
  /audio.ts
  /metadata.ts
  /cutting.ts
  /subtitles.ts
  /compose.ts

/server/ai
  /transcription.ts
  /voiceActivity.ts
  /wordBoundaries.ts
  /scriptSelector.ts
  /scriptSelectionPrompts.ts
  /contentPlanner.ts
  /edlTranscript.ts
  /transcriptGaps.ts
  /transcriptTiming.ts
  /fillerWords.ts
  /profanity.ts
  /openRouterClient.ts

/server/hyperframes
  /renderer.ts
  /render.ts
  /diagnostics.ts
  /templates

/server/pipeline
  /processProject.ts
  /renderProject.ts
  /steps

## Architecture Rules

* Keep API routes thin.
* Do not put FFmpeg or transcription logic directly inside route handlers.
* Keep each pipeline step as a separate function.
* Centralize file paths in `lib/storage.ts`.
* Centralize logging in `lib/logger.ts`.
* Centralize shared word boundary / token normalization in `server/ai/wordBoundaries.ts`. Do not duplicate these functions.
* Use provider interfaces for replaceable systems.
* Prefer small files and focused modules.
* Do not rewrite large parts of the project unless asked.
* When re-running analysis on an existing project, always clean up stale DB records (Transcript, EditDecision, RenderAsset) and delete old `clean.mp4` first. This prevents data from a previous run leaking into the new result.
* Always re-render `clean.mp4` in the final render phase — never reuse a cached file from the analysis phase, because the EDL may have changed.

## Provider Interfaces

Keep these systems replaceable:

```ts
interface TranscriptionProvider {
  transcribe(input: TranscriptionInput): Promise<Transcript>
}

interface MotionRenderer {
  renderInserts(input: MotionRenderInput): Promise<MotionInsert[]>
}

interface ContentPlanner {
  plan(input: ContentPlanInput): Promise<ContentPlan>
}
```

MVP implementations:

* `ElevenLabsTranscriptionProvider` (`server/ai/elevenLabsTranscription.ts`) is the current production STT provider. It must support `ELEVENLABS_PROXY_URL` and use word-level timestamps.
* `LocalWhisperTranscriptionProvider` (local `stable-ts` / `faster-whisper` based stack, with DTW alignment)
* Speaker/activity detection split across `server/ai/voiceActivity.ts`:
  * coarse main-speaker diarization/speech ranges from WhisperX/pyannote when available
  * `SileroVoiceActivity` via `scripts/detect_silero_vad.py` as fine pause layer and fallback
* `GeminiMelismDetector` is optional and currently disabled in production. Its output is a review/assist layer, not the primary STT source.
* `HyperFramesMotionRenderer`
* `HeuristicContentPlanner`

## Video Rules

* Use FFmpeg for media operations.
* Extract audio as WAV, 16 kHz, mono.
* Final export must be MP4, H.264, AAC audio.
* Generated project videos must use a consistent export profile unless explicitly overridden:
  MP4 container, H.264 video, AAC audio, `4000 kbps` video bitrate, `30 fps`, `yuv420p`, and `Rec.709 SDR` color tagging.
* Apply this export profile not only to the final MP4, but also to generated project video artifacts such as clean previews, subtitle overlays, split-layout videos, infographic renders, review previews, and HyperFrames-rendered MP4 assets.
* Preserve the source orientation through upload normalization, clean preview, styled preview, and final export.
* Portrait projects must stay `1080x1920`.
* Landscape projects must stay `1920x1080`.
* Preserve audio/video sync.
* Use local storage under `/storage`.
* Do not keep large video files in memory.
* Validate that the uploaded video has an audio track before proceeding. Reject videos without audio early with a clear error.
* FFmpeg binary resolution: check `./bin/ffmpeg` first, fall back to system PATH. Do not fail silently with ENOENT when `./bin/` is empty.

## Cutting Rules

Default cutting should be conservative.

Minimum kept fragment duration: `0.5s`. This threshold is used consistently in both `cutting.ts` (`complementRanges`) and `planCuts.ts` (`MIN_KEPT_FRAGMENT`). Do not add a second threshold — keep them unified.

Timing policy note: shared cut thresholds must live in one central policy module and be reused everywhere they affect EDL generation or render boundaries. In particular, the project uses one shared source of truth for:

* minimum kept fragment duration: `0.5s`
* removable refined word-gap threshold: `0.3s`
* inward pause handles around safe removals: `0.2s` (increased for stable-ts DTW boundary safety)
* minimum `untranscribed_voice` duration in `pauses_and_fillers` and `semantic_cleanup`: `0.3s`
* conservative transcript-gap fallback threshold without VAD: `1.0s`

Do not reintroduce duplicated hardcoded timing constants in separate files.

Current source-of-truth order for cutting:

1. Coarse main-speaker speech ranges come from transcript diarization / `pyannote` when available via `server/ai/voiceActivity.ts`. They are the primary source of truth for whose speech belongs to the final monologue.
2. `Silero VAD` is the fine speech/no-speech layer for local pause boundaries and the fallback when diarization is unavailable.
3. The active transcription provider is the source of truth for what words were said. Production currently uses ElevenLabs `scribe_v2` word timestamps; local `stable-ts` remains a fallback provider.
4. Transcript timing normalization still treats provider word timestamps as untrusted until validated. If timings are suspicious, repair conservatively using VAD speech ranges and neighboring reliable words.
5. `MFA` (`server/ai/mfaAlignment.ts`) is an optional selective fallback only for suspicious word timing repair on chosen segments when enabled. It does not replace ElevenLabs/stable-ts transcription, diarization, or the semantic script selector.
6. `AI script selector` (`server/ai/scriptSelector.ts`, prompts in `server/ai/scriptSelectionPrompts.ts`) is the main semantic source of truth only for `semantic_cleanup`. It must decide which exact spoken words stay in the final video, not which words to delete.
7. `planCuts.ts` always handles technical cleanup by deterministic rules: pause removal, hesitation cleanup, and `untranscribed_voice` cleanup according to the selected cleanup mode.
8. Heuristics in `planCuts.ts`, `fillerWords.ts`, and `profanity.ts` are fallback/safety layers when AI is unavailable or misses obvious removals.

Important: do not go back to cutting pauses purely by FFmpeg volume/RMS or raw Whisper word gaps. Street noise, cars, wind, room noise, and handling noise can be loud but are not the speaker's voice. Volume is only a diagnostic signal. VAD decides speech/no-speech, Whisper supplies text, AI selects the final spoken script.

`silence.ts` (FFmpeg silencedetect) has been removed from the codebase — do not reintroduce it.

Transcription provider word timestamps must be treated as untrusted until normalized. After transcription and before AI script selection/cut planning, validate word timings for impossible or suspicious values: negative times, zero or near-zero duration, `end <= start`, overlaps, non-monotonic order, and durations that are implausibly short for the word length/syllable count. When a word timestamp is suspicious, do not cut directly by that raw provider boundary. Prefer VAD speech segments, neighboring valid word timings, and conservative timing repair/redistribution inside the nearest VAD speech segment. The active STT provider remains authoritative for the spoken text, not for unsafe raw timing boundaries.

When selective MFA fallback is enabled, use it only on suspicious segments, not on the full video by default. Suspicious segments are detected from timing/pathology signals such as large internal word gaps, large segment edge drift, implausible durations, overlaps, or low-confidence words. MFA may refine word timings for those segments only when its aligned token sequence still matches the original spoken words after normalization. If MFA output changes tokens, drops tokens, or otherwise fails merge validation, discard the MFA result and keep stable-ts timings.

For final pause cleanup, use cut-boundary refinement before converting word-to-word gaps into removals. The system should refine only the boundary words around future edit points using the extracted 16 kHz mono WAV, VAD speech ranges, and local audio energy. If a refined pause between adjacent words is longer than `0.3s`, remove the middle while keeping `0.2s` after the previous word and `0.2s` before the next word. This refinement is a local cleanup layer for edit boundaries, not a replacement for Whisper text, AI script selection, or VAD/diarization source-of-truth.

When both coarse VAD/diarization gaps and refined word-gap pauses exist for the same location, the refined word-gap pause is the precise source of truth. Do not keep a second overlapping broad `vad_pause` for that same gap. Coarse VAD gaps should remain only for standalone no-speech regions that are not already explained by reliable neighboring words.

Cleanup modes are fixed and explicit. Do not reintroduce `low / medium / high` intensity levels.

Allowed cleanup modes:

* `pauses_only` — remove only pauses between words; do not remove filler words or semantic content.
* `pauses_and_fillers` — remove pauses, elongated hesitation sounds, untranscribed voice-like junk between reliable words, and short filler words when they do not carry sentence meaning.
* `semantic_cleanup` — AI selects the final spoken script by meaning; after that, pauses and speech junk are still removed deterministically.

Obvious elongated hesitation sounds are a deterministic safety layer in `pauses_and_fillers` and `semantic_cleanup`, even when AI script selection is enabled. Examples include repeated/prolonged `ээ`, `мм`, `эм`, `аа`, `бэ`, and similar short hesitation tokens when their removal is safe by timing. This safety layer must log how many hesitation removals were added. Do not remove meaningful words only because they look short or have suspicious Whisper timings.

This hesitation layer should also catch elongated variants that Whisper often writes phonetically, for example `мэээ`, `бэээ`, `нуууу`, `эммм`, and similar stretched vocalized fillers, when removal is safe by timing and does not break meaning.

If the active STT provider does not transcribe a hesitation sound at all, but VAD detects a voice-like range between two reliable words and that range does not contain transcript words, remove it in `pauses_and_fillers` and `semantic_cleanup` once it reaches the central `untranscribed_voice` minimum duration. This rule exists specifically to catch real-world `эээ/мэээ/нууу` cases that STT providers may skip. Do not suppress internal voice-like gaps merely because they sit inside one continuous main-speaker speech range; continuity protection is for avoiding unsafe cuts through supported speech, not for keeping unsupported filler sounds between reliable words.

If Silero VAD fails, the system may fall back to transcript-gap pause detection, but that path must stay conservative and must log the fallback reason clearly.

Transcript-gap fallback rule:

* Without working VAD, remove only confirmed quiet transcript gaps conservatively.
* The fallback minimum removable gap is `1.0s` unless a stricter policy is explicitly introduced in the central timing policy.
* Audible gaps without VAD support should be logged as noisy/audible, not silently cut.

Voice/transcript mismatch rule:

* `untranscribed_voice` ranges detected from VAD without reliable transcript words are diagnostic-only in `pauses_only`.
* In `pauses_and_fillers` and `semantic_cleanup`, such ranges may enter the final EDL when they are at least `0.3s` and clearly unsupported by reliable word timings.
* Keep the reason visible in logs/EDL; do not silently merge it away into an uninformative generic label if that would hide why the range was removed.

Primary AI flow:

1. AI reads the full normalized transcript with word timestamps.
2. AI pass 1 builds only `keep_segments`: the exact final text that should remain.
3. AI pass 2 reviews the proposed keep-plan and removes earlier duplicates, retake leftovers, and technical chatter that survived pass 1.
4. If the same thought appears several times, keep the last complete successful version.
5. If the speaker says an earlier version, then correction markers like `хотя нет`, `нет`, `по-другому`, `надо по-другому`, `стоп`, `заново`, and then says the idea again, keep only the later complete version.
6. `planCuts.ts` adds a `0.3s` semantic handle before/after AI-selected keep segments where possible.
7. After final text selection, pauses/no-speech gaps inside the kept text are removed with a `0.2s` inward handle from the end of previous speech and before the start of next speech.

Current AI provider routing:

1. Script selector pass 1 (`keep-plan`) may use a different provider/model than pass 2.
2. Routing is controlled by env vars, not hardcoded model names:
   `SCRIPT_SELECTOR_PASS1_AI_PROVIDER`, `SCRIPT_SELECTOR_PASS2_AI_PROVIDER`, and the provider configs in `.env`.
3. Current default split is:
   pass 1 -> KIE/Gemini-compatible endpoint
   pass 2 -> OpenRouter/GPT-compatible endpoint
4. Keep both providers available. Do not replace one provider when adding another unless explicitly requested.

Keep:

* the final coherent monologue in the speaker's original words;
* the later successful version of a retake;
* meaningful connectors like `короче`, `ну`, `вот` when they introduce a real thought;
* rhetorical repetition, callbacks, summaries, or repeated phrases that intentionally add emphasis or meaning;
* any earlier phrase that contains a distinct useful fact not present in the later version.

Do not keep:

* technical recording chatter;
* abandoned starts and very short meaningless fragments;
* earlier failed/weaker duplicate takes when a later complete version replaces them;
* correction markers that only explain the retake, for example `хотя нет, по-другому`;
* in `semantic_cleanup`, clear profanity-only emotional outbursts, even if the AI API is unavailable.

Profanity list note: `блин` is NOT profanity — it is a mild euphemism. Do not add it to the profanity word list.

Safety rules:

* background noise by itself if it overlaps useful speech;
* do not drop words just because Whisper word timestamps look strange;
* keep connector words like `короче`, `ну`, `вот` when they introduce a meaningful thought;
* keep rhetorical repetition, callbacks, summaries, or repeated phrases that intentionally add emphasis or meaning;
* keep any passage if dropping it may break meaning or produce an unnatural jump.

Russian filler words:
ээ
эм
ну
типа
короче
как бы
вот
значит
это самое
И другие подобные им.

Russian elongated hesitation examples:
эээ
ээээ
ммм
мммм
эммм
ааа
бэ

English filler words:
um
uh
like
you know
so
basically
actually
I mean

Do not drop filler words when removing them may break meaning.

AI validation notes:

* AI-proposed keep segments must be validated against transcript word boundaries.
* Keep segments must use original spoken words only. Do not rewrite or invent text.
* Keep segments should be reviewed so earlier duplicate takes are not accidentally kept.
* Logs must distinguish what AI selected, what review accepted, what validation rejected, what pause cleanup added, and what finally reached the EDL.
* `contentPlan` should be generated from transcript text after the final EDL, so rejected takes, profanity, and off-narrative text do not leak into descriptions, titles, or motion cards.

## Subtitles

* Generate ASS subtitles.
* Burn subtitles into the final MP4.
* Keep captions readable on mobile.
* Use adaptive chunking: 3-7 words per chunk, max ~40 characters. Do not use a fixed chunk size.
* Use max 2 lines.
* Avoid covering the speaker’s face when possible.
* Support Russian and English.
* Primary subtitle path: Native HTML video rendering inside HyperFrames with continuous semantic visual planning (kinetic typography and PIP metrics). Fallback: FFmpeg ASS burn.
* The target UX is no longer "plain subtitles plus occasional cards". The spoken text should become the main visual layer: most spoken phrases are represented as animated contextual text, while numbers, warnings, lists, definitions, contrasts, and CTAs are upgraded into preset-based visual inserts.

Style presets:

* `clean_expert`
* `dynamic_viral`
* `premium_calm`

## HyperFrames

Use HyperFrames for the continuous semantic visual layer. Do not treat HyperFrames as occasional decorative cards only.

MVP templates:

* hook title card;
* key point card;
* CTA end card;
* kinetic_text (continuous typography);
* PIP metric cards (numbers, charts, checklists).
* lesson_title, myth_strike, stat_panel, and concept_map for full-frame/HUD-style visual explanations inspired by viral course/reels references.

Continuous Semantic Overlay:
* The visual planner (`visualPlanner.ts`) runs continuously over the final transcript after the clean cut.
* The base unit for visual planning is no longer a subtitle chunk. Use `server/ai/timedVisualSegments.ts` to split cleaned speech into short word-timed visual moments from real `TranscriptWord.start/end` values.
* The deterministic planner must cover the spoken text first with word-timed visual beats. AI may upgrade already-covered moments, but it must not return a sparse plan that leaves ordinary speech with no visual text.
* AI should think like a viral reels editor: one hand on the spoken words/timings, the other on the allowed HyperFrames preset registry. It may choose titles, kinetic words, big numbers, HUD panels, checklists, myth/strike frames, concept maps, icons, graph-like panels, and CTA plates when they visually reinforce what the author says.
* Give AI creative freedom inside the registry, but keep guardrails against real failure modes: no invented facts/numbers/names/offers, no unknown templates/presets/motions, no 300-insert-per-second spam, no visible text that drifts away from the spoken meaning, and no payloads too large to fit.
* AI should preserve `sourceMomentId`; server-side preflight preserves deterministic start/duration for continuous plans. Do not let preflight shift visual beats into a queue, because that breaks synchronization with the author's words.
* Regular speech is mapped to `kinetic_text`; numbers, warnings, lists, definitions, comparisons, growth/progress phrases, insights, and CTAs should be upgraded into validated preset instances when useful.
* Current reusable semantic overlay templates include `kinetic_text`, `big_number`, `metric_chart`, `checklist`, `bullet_cards`, `keyword_slam`, `lesson_title`, `myth_strike`, `stat_panel`, `concept_map`, and `cta_plate`.
* Current registry presets include local-library-inspired caption/effect styles such as `caption_kinetic_slam`, `caption_emoji_pop`, `caption_gradient_fill`, `caption_highlight`, `caption_neon_glow`, `caption_glitch_rgb`, `caption_matrix_decode`, `caption_editorial_emphasis`, `caption_particle_burst`, `caption_clip_wipe`, plus larger course/HUD presets such as `hud_ratio_panel`, `golden_ratio_panel`, `lesson_title_block`, `lesson_title_cinematic`, `myth_strike_redline`, and `concept_orbit_map`.
* Visible overlay text must not be shortened with ellipses. If a non-kinetic card cannot fit the full phrase safely, preflight should fall back to full-source `kinetic_text` instead of clipping the wording.
* Do not split words in the middle. Layout must prefer full-word wrapping, font-size reduction, or beat splitting over `overflow-wrap:anywhere`, hyphenation, or character-level breaking.
* Kinetic fallback must use the original spoken `sourceText`, not a synthetic string reconstructed from card payload fields such as `eyebrow`, `title`, or `items`.
* The local visual preset registry is the source of truth for reusable overlay compositions. Current key modules:
  * `server/hyperframes/visualRegistry.ts` — template/style/preset registry.
  * `server/ai/visualPlanner.ts` — continuous semantic planner and AI merge path.
  * `server/ai/timedVisualSegments.ts` — word-timed visual moment segmentation.
  * `server/hyperframes/visualLayoutPreflight.ts` — pre-render layout/payload safety pass.
  * `server/hyperframes/templates/SemanticOverlay.ts` — deterministic HyperFrames overlay template.
  * `lib/visualStyleOptions.ts` — saved user-facing visual options parser.
* Before rendering, run a preflight pass that normalizes payload text, splits too-long kinetic phrases, validates template/preset choices, applies disabled-template options, and falls back to `kinetic_phrase_safe` when a preset is unsafe. In continuous mode, preflight must preserve the plan's word-derived timing instead of extending or shifting beats for reading-time estimates.
* Style controls are preset-driven. Current persisted options include `visualDensity`, `motionIntensity`, `presetPack`, and `disabledTemplates` inside `styleOptionsJson`.
* Production semantic overlays should render HyperFrames as a graphic-only layer and then composite it over `clean.mp4` with FFmpeg while preserving clean audio. Do not render the source/clean video inside the HyperFrames HTML composition unless an alpha-capable render path is introduced and validated.
* Current semantic overlays are graphic-only. Full reference-style scenes with source video embedded as PIP, branded background, logo, and course-layout composition require an explicit split/PIP composition path; do not fake that by placing source video inside the graphic-only overlay until the alpha/video composition path is validated.
* The renderer should attempt alpha overlay only when the produced video really contains an alpha channel. If HyperFrames WebM renders without alpha, detect that with `ffprobe` and fall back to chroma-key compositing.
* If chroma-key compositing is used for the graphic-only layer, avoid blur filters, semi-transparent text, transparent color mixes, and key-color shadows/glows because they create colored spill around text. Prefer opaque elements and hard strokes; switch to true alpha output when HyperFrames rendering supports it reliably on the server.

Rules:

* HyperFrames is optional only in the sense that final export must still succeed if the visual layer fails. Product quality target is HyperFrames-first.
* If HyperFrames fails, retry with safe kinetic-only overlay before falling back to FFmpeg/ASS subtitles.
* Do not overuse large insert cards. The continuous text layer can be dense, but heavy cards/charts should remain contextual.
* For a 30–60 second video, use continuous kinetic text throughout and reserve strong cards/charts for the most relevant moments.
* Do not use a local-Chromium-first render strategy. HyperFrames rendering mode must be chosen explicitly up front, not by first trying a flaky path and only then falling back.
* Default local development render mode is Docker-backed HyperFrames rendering.
* Production/container render mode may intentionally use direct local HyperFrames/Chrome rendering only when that environment is already provisioned for it and Docker-in-Docker or host-socket rendering would be less reliable because of filesystem/path mapping.
* On the current Beget server, Docker may be unavailable even when `HYPERFRAMES_RENDER_MODE=docker`. The renderer must fall back from Docker to local HyperFrames/Chrome when Docker is missing.
* When using direct local HyperFrames rendering, force software browser rendering (`PRODUCER_BROWSER_GPU_MODE=software`) and keep render concurrency conservative.

### Local HyperFrames Library

The local workspace now includes a bundled HyperFrames library for presets, transitions, effects, captions, and reference projects:

* registry sandbox project: `hyperframes-library/projects/studio-demo`
* official reference projects: `hyperframes-library/library/official`
* community reference projects: `hyperframes-library/library/community/hyperframes-student-kit`

Installed official HyperFrames registry state:

* `85` registry items installed locally
* `installed_items=85`
* `failed_items=0`

This local library includes:

* blocks
* components
* caption styles
* shader and transition packs
* VFX and liquid-glass effects
* social overlays
* map/chart blocks
* official launch/demo references
* community short-form and promo references

When looking for reusable HyperFrames visuals, transitions, or preset compositions, check this local library first before creating effects from scratch.

## Template Builder UX

The visual template builder lives at `/templates/new`.

Product intent:

* It is a mobile-first style/template creation surface for the autopilot, not a manual timeline editor.
* The user creates a reusable visual system: typography, colors, surfaces, shadows, motion, and preferred HyperFrames preset categories.
* Persisted user templates from the database are connected to the render pipeline and AI planner constraints.

UX rules:

* Keep the live talking-head preview fixed/sticky at the top of the screen while the user scrolls controls below.
* Keep the preview compact enough for iPhone use; the sticky preview should stay around the top 30% of the screen so the settings panel remains usable.
* Measure the real height of the sticky preview dynamically to ensure the top preset-slider is never hidden under action buttons.
* Template editor sidebar consists of exactly 5 flat, sequential control panels (no nested accordion wrappers):
  1. **Цветовое решение** — selection of curated optimal color palettes for instant preview, with manual main (text), accent (highlights, strike lines, chart paths), and secondary (background) color overrides.
  2. **Заголовки** — font, text color, size/boundaries (auto-scaled), border/shadow style, entrance animation, and exit animation settings.
  3. **Обычный текст** — body text / word-by-word settings including font, text color, size/boundaries, border/shadow, entrance animation, and exit animation settings.
  4. **Акцентные цифры** — big stats / metric panels including font, text color, size/boundaries, border/shadow, entrance animation, and exit animation settings.
  5. **Элементы** (checklists, growth charts, warning cards, mind maps, comparisons, CTAs) — unified settings for font, text/accent/background colors, position coords, surface backdrop (style, transparency, borders), entrance animation, and exit animation. Edits to elements propagate shared settings to all element blocks (list, comparison, accent, chart, cta) simultaneously to maintain style cohesion, while allowing the user to select block-specific layout presets and test their look via a dynamic selector.
* Every block type supports exit transitions (`animationOut`), mapped as `motionOutId` in the generated `VisualBeat` payload and parsed into GSAP exit transitions within the HTML template container.
* Users can position any non-theme block using draggable handlers directly over the sticky video preview.
* Template changes must be confirmed via a global "Сохранить изменения" button.

Integration Architecture:

* **Db Persistence**: Custom templates are saved to the `Template` table in the SQLite database and can be marked as default (`isDefault: true`).
* **Style Mapping**: The default template or active custom template is read during project creation/update. Its theme properties are serialized into `styleOptionsJson` as `visualTemplateId` and `visualTemplate` alongside derived properties:
  * If the template uses the `editorial` font, `presetPack` is mapped to `premium`.
  * If `defaultAnimationSpeed` is low (e.g. `< 0.38`), `motionIntensity` is mapped to `calm`.
  * Any disabled blocks in the template are mapped to `disabledTemplates`.
* **State Preservation**: Front-end state forms and back-end patch requests must preserve `visualTemplateId` and `visualTemplate` inside `styleOptionsJson` instead of discarding them.
* **Rendering Path**: The visual planner uses these properties to select matching HyperFrames presets (e.g. premium glass-cards) during video generation, ensuring that the custom styling is reflected in the final output.
* **Exit Animations**: Mapped from the block's `animationOut` field to the beat's `motionOutId` (defaults to `slide-up`). The generated semantic overlay timeline applies corresponding GSAP exit transitions (`slide-up`, `slide-down`, `fade`, `scale-down`, `none`) before the beat duration ends.

## Database

Use Prisma + SQLite.

Models:

* `Project`
* `Transcript`
* `EditDecision`
* `RenderAsset`
* `ProcessingLog`

Project statuses:
uploaded
extracting_audio
transcribing
planning
draft_ready
rendering_clean_video
rendering_preview
review_ready
rendering_final
done
error

Recovery: `lib/jobs.ts` exports `resetStuckProjects()`. On server startup, recovery should immediately reset stale processing statuses from a previous crashed/restarted process to `error` when there is no active in-memory job for that project. Do not keep projects blocked in `rendering_preview`/`rendering_final` waiting for an old timeout window after restart.

Compatibility note: recovery logic may still recognize legacy intermediate statuses such as `rendering_subtitles`, `rendering_motion`, or `composing_final` if older DB rows contain them.

## API

Required endpoints:
POST /api/projects/upload
POST /api/projects/{id}/process
POST /api/projects/{id}/draft-edits
POST /api/projects/{id}/render
POST /api/projects/{id}/finalize
GET  /api/projects/{id}
GET  /api/projects/{id}/clean
GET  /api/projects/{id}/review
GET  /api/projects/{id}/original
GET  /api/projects/{id}/download
GET  /api/projects/{id}/logs
GET  /api/projects/{id}/transcript
GET  /api/projects/{id}/edl
POST /api/projects/{id}/voice

Validate inputs and return clear errors.

Draft edit API rules:

* `POST /api/projects/{id}/draft-edits` is for confirmed user edits only, not for simple text selection.
* Supported actions should stay explicit, for example `restore_removed_range`, `delete_range`, `delete_word`, and `reset_draft`.
* API routes must remain thin; put EDL mutation and clean preview re-rendering in server/pipeline helpers.
* After a draft edit, delete or invalidate stale `clean.mp4`, `review.mp4`, `final.mp4`, subtitle overlays, split-layout artifacts, and related `RenderAsset` records before continuing.

## Errors

Errors must be actionable.

Good:
FFmpeg was not found. Install FFmpeg and make sure it is available in PATH.

Bad:
Something went wrong.

Required steps may fail the project:

* upload;
* audio extraction;
* transcription;
* clean video rendering;
* final composition.

Optional steps should not fail the whole project:

* HyperFrames inserts;
* description generation;
* hashtags.

## Commands

Use existing scripts if present.

Expected commands:

pnpm install
pnpm dev
pnpm build
pnpm start
pnpm typecheck
pnpm lint

Before finishing a task, run relevant checks.

Current note: there is no top-level `pnpm test` script yet. Use existing targeted checks, for example `pnpm exec tsx scripts/test-cut-normalization.ts`, when they are relevant.

If a script does not exist, do not invent it. Add it only when appropriate.

## Security

* Do not commit secrets.
* Do not log `.env` values.
* Sanitize uploaded filenames.
* Prevent path traversal.
* Do not send uploaded videos to external APIs unless explicitly configured.
* Local Whisper is the default for privacy.

## Python Environment

Python subprocesses (WhisperX, pyannote, Silero VAD, MFA helpers) must receive controlled environment variables to prevent writes outside the project:

* `HF_HOME`, `HUGGINGFACE_HUB_CACHE` → `storage/models/huggingface`
* `TORCH_HOME` → `storage/models/torch`
* `PYANNOTE_CACHE` → `storage/models/pyannote`
* `NLTK_DATA` → `storage/models/nltk_data`
* `XDG_CACHE_HOME` → `storage/models/.cache`
* `MPLCONFIGDIR` → `storage/models/.cache/matplotlib`

If adding a new Python dependency that writes to a home directory, add the corresponding env override in `transcription.ts` and `voiceActivity.ts`.

MFA install/runtime rules:

* Do not treat `pip install montreal-forced-aligner` in the main `.venv` as a sufficient installation. The Python wheel alone is not enough for a working CLI on this project.
* Local MFA is provisioned in a separate micromamba/conda-style environment under `storage/models/mfa-env`.
* The local MFA root/cache/home directories live under project storage:
  * `storage/models/mfa-root`
  * `storage/models/mamba-home`
  * `storage/models/.cache`
* When invoking MFA, ensure `PATH` includes `storage/models/mfa-env/bin` so bundled `openfst`/Kaldi binaries such as `fstcompile` are visible.
* Current default local Russian models are:
  * acoustic: `russian_mfa`
  * dictionary: `russian_mfa`

## Done Criteria

A task is done when:

* the main flow still works;
* changed code is typed correctly;
* relevant checks pass;
* errors are clear;
* logs are useful;
* limitations are documented.

The MVP is done when a user can upload a raw talking-head video and download a final source-oriented MP4 with clean cuts, subtitles, and at least attempted HyperFrames inserts.

## Main Rule

Always optimize for this:

User records a thought → uploads it → gets a publish-ready video without manual editing.

## Supporting Docs

Additional working documents live in `/docs`.

Current references:

- `docs/draft-editing-plan.md` — future draft editing and voice/text correction plan.
- `docs/hyperframes-motion-library.md` — motion library plan for fonts, subtitle styles, infographic elements, transitions, and reusable HyperFrames assets.
- `docs/process-work-log.md` — brief working log of important fixes, decisions, results, and follow-ups. Read it before non-trivial changes and append a short entry after meaningful implementation/deploy work.
- `docs/render-flow-plan.md` — target product flow for cleanup mode, presentation mode, style selection, preview review, corrections, and final export.

## Documentation Updates

When an agent introduces or agrees on a new architectural decision, changes the source-of-truth order, replaces a provider, changes the product direction, or establishes a durable project rule, the agent should proactively consider updating this `AGENTS.md` file.

Before writing such a documentation update, the agent must ask Nikita:

`Внести это правило/решение в AGENTS.md?`

Only update `AGENTS.md` after explicit confirmation, unless Nikita directly asked to update it.
