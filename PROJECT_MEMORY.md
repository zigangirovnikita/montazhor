# Project Memory

## Current stable state
- What currently works:
  - Main product shape is stable: upload -> analyze draft -> review -> render/finalize.
  - Main UI is now desktop-first on `https://hermes.marketologii.ru/`: Russian dashboard, persistent collapsible sidebar, upload zone, recent projects, and project editor tabs with a persistent right-side live preview.
  - The subtitle-style path now includes a dedicated preset studio with 8 preset cards, separate base/accent text controls, insert toggles, and local browser preview updates without immediate heavy rerender.
  - Project editor now keeps `LiveCaptionPreview` visible across text cleanup, subtitle style selection, effects placeholder, and posting placeholder tabs.
  - Server deploy on `/opt/montazhor` is currently aligned with GitHub branch `stabilize/browser-renderer-mvp` at commit `bfd35d2`; key app file hashes were checked after deploy and matched local exactly.
  - Next.js app, Prisma schema, and in-memory job orchestration are wired together.
  - Production runtime is expected to be on the remote server under `/opt/montazhor`; verify current deployment state before making production assumptions.
  - Local Mac checks are preliminary only; server-side checks under `/opt/montazhor` or an isolated server copy are authoritative for typecheck, tests, rendering, provider wiring, and production-like validation.
  - Production transcription uses ElevenLabs `scribe_v2` with word timestamps through local Xray proxy.
  - Voice activity still relies on pyannote/Silero fallback logic.
  - Build, typecheck, and lint status must be re-verified in the current session before claiming the project is clean.
  - Scene pipeline currently renders compiled semantic blocks without obvious coverage gaps in the latest audit sample.
  - Browser captions active-box PPM parsing is fixed so binary frame pixels that look like whitespace no longer trigger false `PPM frame payload is truncated` failures.
- What is currently broken:
  - Server logs showed recurring `Failed to find Server Action "x"` errors on the remote runtime and should be treated as an active deployment/runtime issue until re-verified.
  - Remote audit reported `ProjectAuditEvent` schema/runtime mismatch or missing table state; verify actual deployed DB migration state before relying on audit events in production.

## Active problems
### Problem: Remote server action mismatch
Status: open
Date: 2026-06-18
Files involved:
- remote runtime / deployment state
- Next.js production build artifacts
Symptoms:
- Remote service logs showed `Failed to find Server Action "x". This request might be from an older or newer deployment.`
Root cause:
- Not confirmed. Most likely stale client/server build mismatch or requests crossing deployments.
What worked:
- Service itself was still active and serving.
What did not work:
- Leaving the deployment state unchecked; the log error repeated more than once.
Tests/commands:
- `systemctl status montazhor.service`
- inspect recent server logs before and after deploy
Next safe step:
- Re-verify server deploy flow and confirm client/server artifacts are from the same build generation.

### Problem: Production audit-event persistence state unclear
Status: open
Date: 2026-06-18
Files involved:
- `prisma/schema.prisma`
- production SQLite DB / deployed migrations
- audit-writing code paths
Symptoms:
- Audit report said `ProjectAuditEvent missing` / `SQLite schema for ProjectAuditEvent: empty`.
Root cause:
- Not confirmed. Could be stale database schema on server, wrong DB file, or audit path not writing where expected.
What worked:
- Local Prisma schema clearly includes `ProjectAuditEvent`.
What did not work:
- Assuming production DB matches local schema without checking deployed migration state.
Tests/commands:
- verify production DB schema and migration history
- compare deployed DB file with expected `DATABASE_URL`
Next safe step:
- Inspect the actual production DB schema before changing audit code.

## Failed attempts - do not repeat
### 2026-06-12 to 2026-06-18 - Reintroducing removed STT architecture pieces
Problem:
- Timestamp and cleanup quality in talking-head pipeline.
Tried:
- Older provider ideas and architecture variants around Parakeet/OpenRouter-style timestamp sourcing.
Result:
- Rejected at architecture level.
Why it failed:
- Current project rules explicitly require ElevenLabs word timestamps as production source of truth; Parakeet was removed and must not be reintroduced without verified word-level timings.
Do not repeat unless:
- A new provider is verified with real word-level timestamps and Nikita explicitly asks for that migration.

### 2026-06-18 - Using Graphify as a mandatory first step
Problem:
- Token waste and noisy navigation for obvious/small tasks.
Tried:
- Auto-running Graphify for broad codebase questions.
Result:
- Replaced with selective-use rules in `AGENTS.md`.
Why it failed:
- For obvious 1-3 file tasks, direct file reads are cheaper and clearer.
Do not repeat unless:
- The task is architectural, cross-file, or the relevant files are not obvious.

## Decisions
### 2026-06-18 - Minimal visual-layer P0 guardrails tightened
Decision:
- Fix only the smallest safe P0 issues in the post-cut visual layer without changing block planning or clean timeline architecture.
Reason:
- The main immediate risks were stale reused scene plans, recipe fallback mismatch inside scene compilation, and silent subtitle loss when any compiled scene existed.
Files affected:
- `server/scene/sceneCompiler.ts`
- `server/scene/sceneRecipeRuntime.ts`
- `server/scene/renderScenePipeline.ts`
- `server/scene/renderScenePipelineSignatures.ts`
- `server/pipeline/renderProject.ts`
- `server/scene/*.test.ts`
Tradeoff:
- Subtitles now stay enabled together with scene composition until a real spoken-text coverage contract exists, so some videos may show duplicate text temporarily instead of risking text loss.

### 2026-06-18 - Graphify is selective, not automatic
Decision:
- Use Graphify only for architecture, cross-file tracing, or non-obvious navigation tasks.
Reason:
- It should reduce search space, not add token cost to trivial edits.
Files affected:
- `AGENTS.md`
- `.codex/hooks.json`
- `.gitignore`
Tradeoff:
- Some architecture questions may still need manual verification after Graphify because broad natural-language queries can be noisy.

### 2026-06-18 - Keep generated Graphify output out of git
Decision:
- Ignore `graphify-out/`.
Reason:
- Graph data is generated state and creates noisy diffs.
Files affected:
- `.gitignore`
Tradeoff:
- A fresh clone must rebuild graph artifacts locally.

### 2026-06-18 - Production server is the validation source of truth
Decision:
- Treat `/opt/montazhor` runtime and `montazhor.service` as primary for deployment verification.
Reason:
- Local Mac environment is not representative for real rendering, startup, and provider wiring.
Files affected:
- `AGENTS.md`
Tradeoff:
- Real validation often requires server checks before declaring fixes done.

### 2026-06-18 - Local checks are smoke tests, server checks are authoritative
Decision:
- Do not claim a PR is fully verified until the relevant server-side checks pass, or Nikita explicitly accepts local-only validation.
Reason:
- The local Mac environment is useful for fast feedback, but it is not the source of truth for build behavior, scene tests, runtime wiring, or production-like render validation.
Files affected:
- `PROJECT_MEMORY.md`
Tradeoff:
- Even small PRs may need a short isolated server check before being treated as fully verified.

### 2026-06-18 - Visual timeline trace added for scene debugging
Decision:
- Persist `visual-timeline-trace.json` next to scene artifacts for object-level scene debugging.
Reason:
- It should explain why a visual insert appeared, which text/recipe survived to compile, where timings came from, and whether the visual was too short or textually misaligned with spoken words.
Files affected:
- `server/scene/visualTimelineTrace.ts`
- `server/scene/renderScenePipeline.ts`
- `lib/storage.ts`
Tradeoff:
- This is diagnostic-only and intentionally does not change scene behavior; the next behavior PR should target director density / rolling-window repetition guard.

### 2026-06-18 - Visual timing policy added for overlay microbeats
Decision:
- Add a small compile-time `visualTimingPolicy` for overlay objects so primary/support visuals stop collapsing into `0.4-1.8s` flashes inside `5-6s` spoken phrases.
Reason:
- Trace on the safe sample showed payload selection was mostly relevant, but object timing was too short and too late because support overlays inherited raw microbeat windows and primary overlays were truncated before the first support beat.
Files affected:
- `server/scene/sceneCompiler.ts`
- `server/scene/visualTimingPolicy.ts`
- `server/scene/visualTimelineTrace.ts`
- `server/scene/visualTimingPolicy.test.ts`
Tradeoff:
- This is still a minimal block-local policy. It improves overlay duration and timing diagnostics without rewriting semantic blocks, block planning, payload extraction, or template behavior. Full-scene timing heuristics remain unchanged.

### 2026-06-21 - Desktop-first Russian frontend shell
Decision:
- Replace the old mobile-centered entry/project UI with a desktop SaaS shell while keeping the working MVP pipeline intact.
Reason:
- The app looked like a narrow mobile screen on desktop and hid the actual product flow behind sparse screens.
Files affected:
- `app/page.tsx`
- `app/project/[id]/page.tsx`
- `app/components/AppShell.tsx`
- `app/components/DashboardHome.tsx`
- `app/components/ProjectEditor.tsx`
- `app/components/ProjectCockpit.tsx`
- `app/components/DraftReview.tsx`
- `app/components/DraftReviewTicker.tsx`
- `app/components/StyleStudio.tsx`
- `app/api/projects/route.ts`
- `app/globals.css`
Tradeoff:
- Some sidebar sections and the effects/posting tabs are explicit placeholders. Style switching is intentionally lightweight and does not trigger heavy rendering.

### 2026-06-21 - Subtitle style studio is browser-local first, export second
Decision:
- Keep subtitle style changes local in the browser preview first, then persist them with debounced `PATCH` saves and flush before export-related actions.
Reason:
- The style tab must feel immediate. Rebinding the video source or tying every click to a heavy render makes the workflow stutter and reintroduces preview restarts.
Files affected:
- `app/components/ProjectCockpit.tsx`
- `app/components/ProjectEditor.tsx`
- `app/components/SubtitleStyleStudio.tsx`
- `app/components/styleState.ts`
- `app/components/subtitleStylePresets.ts`
- `app/components/LiveCaptionPreview.tsx`
- `app/api/projects/[id]/route.ts`
Tradeoff:
- There is now a short debounce window before style changes are persisted to the DB, so export paths must flush pending style saves explicitly before starting any build/output action.

### 2026-06-21 - PPM parser must not skip binary pixel whitespace
Decision:
- In `parsePpm`, skip only the single header separator after `maxValue`, not all following whitespace bytes.
Reason:
- PPM `P6` pixel data is binary. Bytes such as `9`, `10`, `13`, or `32` can be real pixel values. Treating them as extra header whitespace corrupts the payload offset and causes false `PPM frame payload is truncated` errors.
Files affected:
- `server/render/browserFrameActiveBox.ts`
- `server/render/browserFrameActiveBox.test.ts`
Tradeoff:
- `parsePpm` is exported only for targeted regression coverage.

### 2026-06-21 - Playback highlight drift was UI update pressure, not wrong caption timebase
Decision:
- Keep the existing `clean-time` caption/remap model and reduce editor-side playback churn instead of rewriting timing logic.
Reason:
- The confirmed regression path was frontend update pressure: `LiveCaptionPreview` pushed `previewTime` into the parent tree on every animation frame, and `ProjectCockpit` kept polling stable project payloads every 2 seconds even during review. A targeted remap test confirmed browser-caption words already use `transcript + edl` clean-time, so the “subtitles are bound to pre-cut timings” hypothesis did not hold for this path.
Files affected:
- `app/components/LiveCaptionPreview.tsx`
- `app/components/previewPlaybackSync.ts`
- `app/components/previewPlaybackSync.test.ts`
- `app/components/projectPolling.ts`
- `app/components/ProjectCockpit.tsx`
- `server/render/browserFrameRenderPlanFromProject.test.ts`
Tradeoff:
- Parent-level playback time is now intentionally throttled instead of frame-perfect, while the local preview stays frame-accurate. This reduces whole-editor rerenders during playback without changing the subtitle preview’s actual active-word timing.

## Working commands
- dev: `pnpm dev`
- build: `pnpm build`
- start: `pnpm start`
- typecheck: `pnpm typecheck`
- lint: `pnpm lint`
- scene test: `pnpm test:scene`
- elevenlabs test: `pnpm test:elevenlabs`
- melism test: `pnpm test:melism`
- prisma generate: `pnpm prisma:generate`
- prisma push: `pnpm prisma:push`
- hyperframes doctor: `npx hyperframes doctor`

## Dangerous areas
- Files/modules where changes often break things:
  - `server/pipeline/processProject.ts`
  - `server/pipeline/renderProject.ts`
  - `server/pipeline/steps/planCuts.ts`
  - `server/ai/transcriptTiming.ts`
  - `server/ai/voiceActivity.ts`
  - `server/scene/*`
  - `server/hyperframes/*`
  - `lib/storage.ts`
  - `lib/jobs.ts`
  - `app/api/projects/[id]/*`
- Invariants that must not be violated:
  - Keep API routes thin; heavy logic belongs in server/lib modules.
  - Re-run analysis with stale transcript/edit/render records cleaned up first.
  - Final render must not reuse stale `clean.mp4` from analysis after EDL changes.
  - Preserve source orientation through upload, preview, and final export.
  - Do not reintroduce beat-only visual logic over the current scene-composition architecture.
  - Treat provider text as authoritative, but repair suspicious timestamps conservatively before cutting.

## Testing checklist
- Confirm whether validation must happen locally or on the remote server.
- For this project, treat local Mac validation as a preliminary smoke check unless Nikita explicitly accepts local-only validation.
- Prefer isolated server-side validation under `/opt/montazhor` or a temporary server copy before calling scene/render/runtime changes verified.
- For pipeline fixes, verify at least the relevant command set:
  - `pnpm typecheck`
  - `pnpm lint`
  - targeted tests if they exist
- For DB-affecting changes, verify Prisma schema compatibility and migration/runtime state.
- For render/cut/scene changes, verify one end-to-end sample or the closest targeted pipeline check available.
- After a failed fix attempt, record the failure under `Failed attempts - do not repeat`.

## Recent fixes
### 2026-06-21 - Browser captions PPM frame truncation fixed
Status: done
What changed:
- `parsePpm` now preserves binary pixel data correctly when the first pixel bytes look like whitespace.
- Added a regression test for a binary PPM whose first pixel starts with whitespace-like byte values.
Validation:
- Local: `pnpm exec vitest run server/render/browserFrameActiveBox.test.ts`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- Server `/opt/montazhor`: targeted Vitest, `pnpm typecheck`, `pnpm build`.
- `montazhor.service` restarted and `https://hermes.marketologii.ru/` verified.
What remains:
- Re-run the user project that hit the error to confirm the full browser captions render now completes end to end.

### 2026-06-21 - Desktop frontend redesign deployed
Status: done
What changed:
- Added Russian desktop dashboard with upload, quick actions, recent projects, and collapsible sidebar.
- Added project editor shell with four tabs and persistent right-side `LiveCaptionPreview`.
- Added six frontend subtitle style presets; selection updates preview immediately and saves via lightweight `PATCH` without calling `/render` or `/finalize`.
- Hid the obsolete template-builder path from the main user flow.
Validation:
- Local: `pnpm typecheck`, `pnpm lint`, `pnpm build`, headless Chrome screenshots.
- Server `/opt/montazhor`: `pnpm typecheck`, `pnpm build`, service restart.
- Public URL `https://hermes.marketologii.ru/` verified with the Russian dashboard.
What remains:
- Mobile polish, real effects implementation, AI post metadata generation, and deeper transcript/timeline UI polish.

### 2026-06-18 - Visual layer minimal P0 PR
Status: done
What changed:
- `sceneCompiler` now carries the validated/fallback recipe id through downstream compile helpers instead of partially using the stale original recipe id.
- `renderScenePipeline` now persists and checks semantic/signature arrays before reusing `director-plan.json` or `screen-copy-plan.json`.
- `renderProject` no longer auto-disables standalone subtitles only because `compiledScenePlan.blocks.length > 0`.
What remains:
- P1: semantic blocks still originate from subtitle chunking rather than a dedicated remapped transcript block contract.
- P1: scene coverage still does not prove continuous spoken-text coverage.
- P1: standalone subtitles remain temporarily enabled on top of scene composition because the scene pipeline still lacks a reliable speech_text coverage contract; this prevents silent text loss but can cause subtitle/scene overlay collisions until a dedicated coverage contract and subtitle/scene safe-area coordination are added.
- P2: full-scene hidden-speaker composition and broader HyperFrames guardrails still need dedicated tightening.
Checks passed:
- `pnpm typecheck`
- `pnpm test:scene`

### 2026-06-18 - Visual timing policy / microbeat duration PR
Status: done
What changed:
- Added `server/scene/visualTimingPolicy.ts` and applied it inside `compileScenePlan` after raw overlay beats are built.
- Primary overlays now try to hold most of the semantic block, support overlays get a safe minimum duration, both stay inside the block, and timings are snapped toward nearby clean word boundaries when subtitle word timings are available.
- `visual-timeline-trace.json` now records whether timing policy changed an object and stores original vs adjusted intervals.
Problem addressed:
- Overlay objects were living only `0.4-1.8s` on spoken phrases around `5-6s`, producing `visual_too_short_for_phrase`, `visual_starts_after_spoken_phrase_started`, and `visual_ends_before_spoken_phrase_finished` warnings.
Checks passed:
- Local: `pnpm typecheck`
- Local: `pnpm test:scene`
- Server isolated copy for code commit `6eda0d7abd874a0a22cd0a5264018204de599104`: `pnpm typecheck`
- Server isolated copy for code commit `6eda0d7abd874a0a22cd0a5264018204de599104`: `pnpm test:scene`
Safe sample trace:
- Baseline from the last verified trace: `visual_too_short_for_phrase=7`, `visual_starts_after_spoken_phrase_started=7`, `visual_ends_before_spoken_phrase_finished=8`, `object_not_aligned_to_word_boundaries=8`.
- Recomputed in isolated server copy after this PR: `visual_too_short_for_phrase=1`, `visual_starts_after_spoken_phrase_started=5`, `visual_ends_before_spoken_phrase_finished=5`, `object_not_aligned_to_word_boundaries=5`.
What remains:
- Remaining worst warnings are mostly on `full_scene` objects, which this PR intentionally does not retime.
- One support overlay on the safe sample is still short relative to its phrase (`durationRatio=0.304`) even after tail-hold extension, so a later PR can add a denser support-vs-primary suppression rule.
- `fallback_applied` warnings remain and are outside the scope of timing policy.
