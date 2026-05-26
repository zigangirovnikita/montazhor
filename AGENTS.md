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
  /api/projects/[id]/route.ts
  /api/projects/[id]/download/route.ts
  /api/projects/[id]/logs/route.ts
  /api/projects/[id]/transcript/route.ts
  /api/projects/[id]/edl/route.ts

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

   ts
interface TranscriptionProvider {
  transcribe(input: TranscriptionInput): Promise<Transcript>
}

interface MotionRenderer {
  renderInserts(input: MotionRenderInput): Promise<MotionInsert[]>
}

interface ContentPlanner {
  plan(input: ContentPlanInput): Promise<ContentPlan>
}

MVP implementations:

* `LocalWhisperTranscriptionProvider`
* `SileroVoiceActivity` via `server/ai/voiceActivity.ts` and `scripts/detect_silero_vad.py`
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

Current source-of-truth order for cutting:

1. `pyannote diarization` (primary) or `Silero VAD` (fallback) via `server/ai/voiceActivity.ts` — main source of truth for where the speaker's voice is present.
2. `Whisper/WhisperX` is the source of truth for what words were said, not for final pause boundaries.
3. `AI script selector` (`server/ai/scriptSelector.ts`, prompts in `server/ai/scriptSelectionPrompts.ts`) is the main semantic source of truth. It must decide which exact spoken words stay in the final video, not which words to delete.
4. `planCuts.ts` converts AI keep-segments into an EDL, adds handles, then removes no-speech pauses inside the kept text.
5. Heuristics in `planCuts.ts`, `fillerWords.ts`, and `profanity.ts` are fallback/safety layers when AI is unavailable or misses obvious high-aggressiveness removals.

Important: do not go back to cutting pauses purely by FFmpeg volume/RMS or raw Whisper word gaps. Street noise, cars, wind, room noise, and handling noise can be loud but are not the speaker's voice. Volume is only a diagnostic signal. VAD decides speech/no-speech, Whisper supplies text, AI selects the final spoken script.

`silence.ts` (FFmpeg silencedetect) has been removed from the codebase — do not reintroduce it.

Whisper word timestamps must be treated as untrusted until normalized. After transcription and before AI script selection/cut planning, validate word timings for impossible or suspicious values: negative times, zero or near-zero duration, `end <= start`, overlaps, non-monotonic order, and durations that are implausibly short for the word length/syllable count. When a word timestamp is suspicious, do not cut directly by that raw Whisper boundary. Prefer Silero VAD speech segments, neighboring valid word timings, and conservative timing repair/redistribution inside the nearest VAD speech segment. Whisper remains authoritative for the spoken text, not for unsafe raw timing boundaries.

For final pause cleanup, use cut-boundary refinement before converting word-to-word gaps into removals. The system should refine only the boundary words around future edit points using the extracted 16 kHz mono WAV, VAD speech ranges, and local audio energy. If a refined pause between adjacent words is longer than `0.4s`, remove the middle while keeping `0.2s` after the previous word and `0.2s` before the next word. This refinement is a local cleanup layer for edit boundaries, not a replacement for Whisper text, AI script selection, or VAD/diarization source-of-truth.

If Silero VAD fails, the system may fall back to transcript-gap pause detection, but that path must stay conservative and must log the fallback reason clearly.

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
* in `high` mode, clear profanity-only emotional outbursts, even if the AI API is unavailable.

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
rendering_subtitles
rendering_motion
composing_final
done
error

Recovery: `lib/jobs.ts` exports `resetStuckProjects()` which finds projects stuck in processing states for more than 10 minutes (e.g. after server crash) and resets them to `error`. Call this on server startup or via a health-check endpoint.

## API

Required endpoints:
POST /api/projects/upload
POST /api/projects/{id}/process
GET  /api/projects/{id}
GET  /api/projects/{id}/download
GET  /api/projects/{id}/logs
GET  /api/projects/{id}/transcript
GET  /api/projects/{id}/edl

Validate inputs and return clear errors.

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
pnpm typecheck
pnpm lint
pnpm test

Before finishing a task, run relevant checks.

If a script does not exist, do not invent it. Add it only when appropriate.

## Security

* Do not commit secrets.
* Do not log `.env` values.
* Sanitize uploaded filenames.
* Prevent path traversal.
* Do not send uploaded videos to external APIs unless explicitly configured.
* Local Whisper is the default for privacy.

## Python Environment

Python subprocesses (WhisperX, pyannote, Silero VAD) must receive controlled environment variables to prevent writes outside the project:

* `HF_HOME`, `HUGGINGFACE_HUB_CACHE` → `storage/models/huggingface`
* `TORCH_HOME` → `storage/models/torch`
* `PYANNOTE_CACHE` → `storage/models/pyannote`
* `NLTK_DATA` → `storage/models/nltk_data`
* `XDG_CACHE_HOME` → `storage/models/.cache`
* `MPLCONFIGDIR` → `storage/models/.cache/matplotlib`

If adding a new Python dependency that writes to a home directory, add the corresponding env override in `transcription.ts` and `voiceActivity.ts`.

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
