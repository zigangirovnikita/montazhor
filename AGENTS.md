# AGENTS.md

## Project

This is an AI autopilot for short-form talking-head videos.

The product is not a traditional video editor and not a CapCut clone.

Core user flow:

Raw talking-head video → automatic cleanup → subtitles → motion inserts → final vertical Reels/Shorts/TikTok video.

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
- Show even very short technical pause removals (`vad_pause`, `pause`, gap ranges) as separate red/strikethrough fragments in transcript review, so the user can understand every edit.
- Do not mark a whole word as removed only because a short technical pause overlaps part of that word's timestamp. A word should be shown as removed only when the removed range covers a meaningful share of the word or the removal is semantic/textual.
- Tapping a word or removed fragment must only select it and show available actions. It must not immediately mutate the EDL or start re-rendering.
- User edits must be confirmed explicitly through an action such as `Удалить и перемонтировать`, `Вернуть`, or another clear apply button.
- Multi-word selection should be supported before applying a delete/remount action.
- Any EDL-changing text action must re-render `clean.mp4` and invalidate old review/final artifacts before the user continues.
- Keep low-level style controls behind `Настроить стиль`; the default style screen should be preset and toggle based.

## MVP Scope

Build the smallest working end-to-end prototype:

1. Upload `mp4`, `mov`, or `webm`.
2. Save original video locally.
3. Extract audio with FFmpeg.
4. Transcribe with local Whisper/faster-whisper/whisper.cpp.
5. Generate transcript JSON.
6. Detect long pauses and obvious filler words.
7. Create an edit decision list.
8. Render a clean cut with FFmpeg.
9. Convert output to vertical `1080x1920`.
10. Generate readable burned-in subtitles.
11. Generate 1–3 simple HyperFrames motion inserts.
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
- Local Whisper provider
- Silero VAD for local voice activity detection
- HyperFrames for motion inserts
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

* `LocalWhisperTranscriptionProvider` (local Whisper/WhisperX-based stack)
* Speaker/activity detection split across `server/ai/voiceActivity.ts`:
  * coarse main-speaker diarization/speech ranges from WhisperX/pyannote when available
  * `SileroVoiceActivity` via `scripts/detect_silero_vad.py` as fine pause layer and fallback
* `HyperFramesMotionRenderer`
* `HeuristicContentPlanner`

## Video Rules

* Use FFmpeg for media operations.
* Extract audio as WAV, 16 kHz, mono.
* Final export must be MP4, H.264, AAC audio.
* Generated project videos must use a consistent export profile unless explicitly overridden:
  MP4 container, H.264 video, AAC audio, `4000 kbps` video bitrate, `30 fps`, `yuv420p`, and `Rec.709 SDR` color tagging.
* Apply this export profile not only to the final MP4, but also to generated project video artifacts such as clean previews, subtitle overlays, split-layout videos, infographic renders, review previews, and HyperFrames-rendered MP4 assets.
* Final resolution: `1080x1920`.
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
* removable refined word-gap threshold: `0.4s`
* inward pause handles around safe removals: `0.2s`
* conservative transcript-gap fallback threshold without VAD: `1.0s`

Do not reintroduce duplicated hardcoded timing constants in separate files.

Current source-of-truth order for cutting:

1. Coarse main-speaker speech ranges come from transcript diarization / `pyannote` when available via `server/ai/voiceActivity.ts`. They are the primary source of truth for whose speech belongs to the final monologue.
2. `Silero VAD` is the fine speech/no-speech layer for local pause boundaries and the fallback when diarization is unavailable.
3. `Whisper/WhisperX` is the source of truth for what words were said, not for final pause boundaries.
4. `MFA` (`server/ai/mfaAlignment.ts`) is an optional selective fallback only for suspicious word timing repair on chosen segments. It does not replace WhisperX transcription, diarization, or the semantic script selector.
5. `AI script selector` (`server/ai/scriptSelector.ts`, prompts in `server/ai/scriptSelectionPrompts.ts`) is the main semantic source of truth only for `semantic_cleanup`. It must decide which exact spoken words stay in the final video, not which words to delete.
6. `planCuts.ts` always handles technical cleanup by deterministic rules: pause removal, hesitation cleanup, and `untranscribed_voice` cleanup according to the selected cleanup mode.
7. Heuristics in `planCuts.ts`, `fillerWords.ts`, and `profanity.ts` are fallback/safety layers when AI is unavailable or misses obvious removals.

Important: do not go back to cutting pauses purely by FFmpeg volume/RMS or raw Whisper word gaps. Street noise, cars, wind, room noise, and handling noise can be loud but are not the speaker's voice. Volume is only a diagnostic signal. VAD decides speech/no-speech, Whisper supplies text, AI selects the final spoken script.

`silence.ts` (FFmpeg silencedetect) has been removed from the codebase — do not reintroduce it.

Whisper word timestamps must be treated as untrusted until normalized. After transcription and before AI script selection/cut planning, validate word timings for impossible or suspicious values: negative times, zero or near-zero duration, `end <= start`, overlaps, non-monotonic order, and durations that are implausibly short for the word length/syllable count. When a word timestamp is suspicious, do not cut directly by that raw Whisper boundary. Prefer Silero VAD speech segments, neighboring valid word timings, and conservative timing repair/redistribution inside the nearest VAD speech segment. Whisper remains authoritative for the spoken text, not for unsafe raw timing boundaries.

When selective MFA fallback is enabled, use it only on suspicious segments, not on the full video by default. Suspicious segments are detected from timing/pathology signals such as large internal word gaps, large segment edge drift, implausible durations, overlaps, or low-confidence words. MFA may refine word timings for those segments only when its aligned token sequence still matches the original spoken words after normalization. If MFA output changes tokens, drops tokens, or otherwise fails merge validation, discard the MFA result and keep WhisperX timings.

For final pause cleanup, use cut-boundary refinement before converting word-to-word gaps into removals. The system should refine only the boundary words around future edit points using the extracted 16 kHz mono WAV, VAD speech ranges, and local audio energy. If a refined pause between adjacent words is longer than `0.4s`, remove the middle while keeping `0.2s` after the previous word and `0.2s` before the next word. This refinement is a local cleanup layer for edit boundaries, not a replacement for Whisper text, AI script selection, or VAD/diarization source-of-truth.

When both coarse VAD/diarization gaps and refined word-gap pauses exist for the same location, the refined word-gap pause is the precise source of truth. Do not keep a second overlapping broad `vad_pause` for that same gap. Coarse VAD gaps should remain only for standalone no-speech regions that are not already explained by reliable neighboring words.

Cleanup modes are fixed and explicit. Do not reintroduce `low / medium / high` intensity levels.

Allowed cleanup modes:

* `pauses_only` — remove only pauses between words; do not remove filler words or semantic content.
* `pauses_and_fillers` — remove pauses, elongated hesitation sounds, untranscribed voice-like junk between reliable words, and short filler words when they do not carry sentence meaning.
* `semantic_cleanup` — AI selects the final spoken script by meaning; after that, pauses and speech junk are still removed deterministically.

Obvious elongated hesitation sounds are a deterministic safety layer in `pauses_and_fillers` and `semantic_cleanup`, even when AI script selection is enabled. Examples include repeated/prolonged `ээ`, `мм`, `эм`, `аа`, `бэ`, and similar short hesitation tokens when their removal is safe by timing. This safety layer must log how many hesitation removals were added. Do not remove meaningful words only because they look short or have suspicious Whisper timings.

This hesitation layer should also catch elongated variants that Whisper often writes phonetically, for example `мэээ`, `бэээ`, `нуууу`, `эммм`, and similar stretched vocalized fillers, when removal is safe by timing and does not break meaning.

If Whisper does not transcribe a hesitation sound at all, but VAD detects a voice-like range between two reliable words and that range does not contain transcript words, remove it in `pauses_and_fillers` and `semantic_cleanup`. This rule exists specifically to catch real-world `эээ/мэээ/нууу` cases that Whisper skips.

If Silero VAD fails, the system may fall back to transcript-gap pause detection, but that path must stay conservative and must log the fallback reason clearly.

Transcript-gap fallback rule:

* Without working VAD, remove only confirmed quiet transcript gaps conservatively.
* The fallback minimum removable gap is `1.0s` unless a stricter policy is explicitly introduced in the central timing policy.
* Audible gaps without VAD support should be logged as noisy/audible, not silently cut.

Voice/transcript mismatch rule:

* `untranscribed_voice` ranges detected from VAD without reliable transcript words are diagnostic-only in `pauses_only`.
* In `pauses_and_fillers` and `semantic_cleanup`, such ranges may enter the final EDL when they are long enough and clearly unsupported by reliable word timings.
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
* Primary subtitle path: HyperFrames overlay (green-screen composited via FFmpeg). Fallback: FFmpeg ASS burn.

Style presets:

* `clean_expert`
* `dynamic_viral`
* `premium_calm`

## HyperFrames

Use HyperFrames for simple motion inserts.

MVP templates:

* hook title card;
* key point card;
* CTA end card.

Rules:

* HyperFrames is optional.
* If HyperFrames fails, log the error and continue without inserts.
* Do not overuse inserts.
* For a 30–60 second video, 1–3 inserts are enough.
* Do not use a local-Chromium-first render strategy. HyperFrames rendering mode must be chosen explicitly up front, not by first trying a flaky path and only then falling back.
* Default local development render mode is Docker-backed HyperFrames rendering.
* Production/container render mode may intentionally use direct local HyperFrames/Chrome rendering only when that environment is already provisioned for it and Docker-in-Docker or host-socket rendering would be less reliable because of filesystem/path mapping.
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

Recovery: `lib/jobs.ts` exports `resetStuckProjects()` which finds projects stuck in processing states for more than 10 minutes (e.g. after server crash) and resets them to `error`. Call this on server startup or via a health-check endpoint.

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

The MVP is done when a user can upload a raw talking-head video and download a final vertical MP4 with clean cuts, subtitles, and at least attempted HyperFrames inserts.

## Main Rule

Always optimize for this:

User records a thought → uploads it → gets a publish-ready video without manual editing.

## Supporting Docs

Additional working documents live in `/docs`.

Current references:

- `docs/draft-editing-plan.md` — future draft editing and voice/text correction plan.
- `docs/hyperframes-motion-library.md` — motion library plan for fonts, subtitle styles, infographic elements, transitions, and reusable HyperFrames assets.
- `docs/render-flow-plan.md` — target product flow for cleanup mode, presentation mode, style selection, preview review, corrections, and final export.

## Documentation Updates

When an agent introduces or agrees on a new architectural decision, changes the source-of-truth order, replaces a provider, changes the product direction, or establishes a durable project rule, the agent should proactively consider updating this `AGENTS.md` file.

Before writing such a documentation update, the agent must ask Nikita:

`Внести это правило/решение в AGENTS.md?`

Only update `AGENTS.md` after explicit confirmation, unless Nikita directly asked to update it.
