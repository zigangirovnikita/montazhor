# Project Memory

## Current stable state
- What currently works:
  - Main product shape is stable: upload -> analyze draft -> review -> render/finalize.
  - Next.js app, Prisma schema, and in-memory job orchestration are wired together.
  - Production runtime is expected to be on the remote server under `/opt/montazhor`; verify current deployment state before making production assumptions.
  - Production transcription uses ElevenLabs `scribe_v2` with word timestamps through local Xray proxy.
  - Voice activity still relies on pyannote/Silero fallback logic.
  - Build, typecheck, and lint status must be re-verified in the current session before claiming the project is clean.
  - Scene pipeline currently renders compiled semantic blocks without obvious coverage gaps in the latest audit sample.
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
- For pipeline fixes, verify at least the relevant command set:
  - `pnpm typecheck`
  - `pnpm lint`
  - targeted tests if they exist
- For DB-affecting changes, verify Prisma schema compatibility and migration/runtime state.
- For render/cut/scene changes, verify one end-to-end sample or the closest targeted pipeline check available.
- After a failed fix attempt, record the failure under `Failed attempts - do not repeat`.
