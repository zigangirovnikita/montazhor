# Process Work Log

Purpose: keep a short memory of important fixes, decisions, results, and follow-ups so the project does not repeat solved mistakes.

How to use:

- Read this file before non-trivial implementation, deployment, or architecture changes.
- After meaningful work, append a brief dated entry.
- Keep entries short: problem, decision, result, follow-up if needed.
- Do not write secrets, passwords, API keys, or private server credentials here.

## Entries

### 2026-06-04 — HyperFrames visuals were disabled by defaults

- Problem: new uploads could default to `subtitles_only` / `cut_subtitles`, so the system produced mostly plain subtitles instead of visual inserts.
- Decision: make new projects default to subtitles plus infographics and update active server projects to the same presentation path.
- Result: the render pipeline attempts semantic HyperFrames overlays by default while preserving subtitle fallback.
- Follow-up: keep preset/style selection after draft cleanup, not before cleanup.

### 2026-06-04 — HyperFrames render stalled when HTML contained clean video

- Problem: rendering the clean/source video inside the HyperFrames composition was unreliable on the server local Chrome path.
- Decision: render HyperFrames as a graphic-only overlay, then composite it over `clean.mp4` with FFmpeg and map the clean audio from the source video.
- Result: server render reached `review_ready` with h264/aac output and semantic visual beats.
- Follow-up: if HyperFrames gets reliable alpha video output, replace chroma-key compositing with true alpha compositing.

### 2026-06-04 — AI planner must use the visual library, not invent visuals

- Problem: asking AI to generate visuals freely risks random effects and inconsistent styling.
- Decision: AI planner can choose only from the local visual registry/templates, timing ranges, layouts, motions, and validated payload schema.
- Result: AI decides moments and preset adjustments, while code keeps the render deterministic and fallbacks safe.
- Follow-up: expand the registry with better reusable presets instead of expanding free-form prompting.

### 2026-06-04 — Green chroma-key spill around overlay text

- Problem: green outlines appeared around white text because blur, semi-transparent text, and transparent color mixes were rendered over a green key background before FFmpeg keying.
- Decision: remove blur filters and transparent decorative elements from keyed HyperFrames overlays; add a dark opaque text stroke to large keyed glyphs; use hard `colorkey` with `blend=0`. Do not run `despill` over the whole overlay before `colorkey`, because it changes the pure green background and can turn the composed result black. Avoid soft key blend for large white text because it preserves green edge pixels.
- Result: expected output has cleaner text edges without green halos.
- Follow-up: verify on server renders; prefer true alpha overlay once available.

### 2026-06-04 — Continuous semantic motion typography v1

- Problem: semantic HyperFrames overlays were sparse, so videos often fell back to plain video or simple subtitle chunks; long text could overflow cards and edges.
- Decision: make the deterministic visual planner cover every subtitle chunk, let AI only upgrade already-covered moments, add beat roles/variants, compact payload limits, browser-side text fitting, safe lower-third fallback, and a second HyperFrames retry with kinetic-only beats.
- Result: local lint/typecheck/build pass, HyperFrames structure lint passes on a synthetic overlay, and runtime browser inspection is blocked locally by macOS Chromium sandbox rather than layout errors.
- Follow-up: deploy and verify on `/opt/montazhor` once SSH credentials are valid; replace chroma-key with true alpha overlay when the production render path supports it.

### 2026-06-04 — Visual overlay architecture v2 deployed

- Problem: v1 still lacked a real preset catalog, product controls, pre-render layout decisions, and reliable renderer fallback when Docker was unavailable.
- Decision: add a reusable visual preset registry, style options for density/motion/preset pack/disabled templates, preflight splitting and fallback, safer entrance motion, server-side alpha detection with chroma fallback, and Docker-to-local HyperFrames fallback.
- Result: server typecheck/lint/build passed; HyperFrames inspect reports 0 issues on synthetic v2 overlay; end-to-end `renderSemanticOverlay` produced 1080x1920 H.264/AAC MP4 on `/opt/montazhor`.
- Follow-up: HyperFrames WebM currently renders as `yuv420p` without alpha on this server, so true alpha is attempted and then safely falls back to chroma-key until the renderer supports alpha output here.

### 2026-06-04 — AI visual planner now must choose a valid preset

- Problem: AI visual beats could omit `presetId` or reference an incompatible preset, and preflight could silently substitute a fallback preset instead of rejecting the bad AI choice.
- Decision: require `presetId` in the visual planner prompt and parser, and reject AI beats unless the preset exists in the registry and matches the same `templateId`.
- Result: AI stays a selector over the preset library instead of partially free-form beat generation.
- Follow-up: if needed, tighten validation further so AI presets must also respect selected preset pack and preferred layouts.

### 2026-06-04 — Style screen now shows the actual visual pack composition

- Problem: style controls exposed pack/density/motion toggles, but the user still could not see what those choices would concretely enable in the overlay.
- Decision: add a preset catalog block to the style screen with pack previews, template composition, and current enabled/disabled template summary; preflight now also remaps mismatched presets to the selected pack and snaps layouts to preset-preferred positions.
- Result: style selection is more testable on real projects, and server render output is more consistent with the selected pack.
- Follow-up: later add true per-preset thumbnail previews instead of textual mini-cards.

### 2026-06-04 — Semantic overlay now uses true alpha first and fragment isolation

- Problem: the normal semantic overlay path still depended on chroma-key for text edges and one failed HyperFrames render could invalidate the whole overlay.
- Decision: switch the primary alpha render path from WebM to MOV/ProRes with verified alpha, split overlay plans into cached render fragments, and composite those fragments over `clean.mp4` with timestamped FFmpeg overlays. Keep chroma-key only as emergency fallback.
- Result: server can render `yuva444p12le` alpha fragments, reuse cached fragments between rerenders, and degrade failed fragments to safe kinetic mode instead of collapsing the whole overlay render.
- Follow-up: if a future HyperFrames version produces stable VP9 alpha on this server, compare MOV-vs-WebM performance and keep the more reliable path.

### 2026-06-04 — Review screen now shows planner choices and supports optional face-safe layout

- Problem: the overlay planner was still a black box at review time, and there was no optional hook to keep overlays away from detected/manual face regions.
- Decision: expose saved `visualPlan` data in the project payload for review, add a planner-choice summary block to the review UI, and let preflight relocate layouts away from optional `face-safe-regions.json` regions inside the project directory.
- Result: review can show which preset landed on which phrase, and the renderer has a concrete path for face/speaker-safe layout when regions are available.
- Follow-up: add automatic face region generation so the optional hook becomes populated by the pipeline itself.
