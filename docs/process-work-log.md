# Process Work Log

Purpose: keep a short memory of important fixes, decisions, results, and follow-ups so the project does not repeat solved mistakes.

How to use:

- Read this file before non-trivial implementation, deployment, or architecture changes.
- After meaningful work, append a brief dated entry.
- Keep entries short: problem, decision, result, follow-up if needed.
- Do not write secrets, passwords, API keys, or private server credentials here.

## Entries

### 2026-06-15 — Visual pipeline migrated to scene-plan source of truth

- Problem: the visual pipeline had three competing contracts: beat-based overlay planning, cinematic template instances, and template-builder theme overrides. That prevented template restrictions, block planning, and full-scene composition from sharing one deterministic source of truth.
- Decision: introduce `server/scene/*` and make the render path run through `semantic blocks -> scene plan -> compiled scene plan -> overlay/full-scene composers`, with `scene-plan.json` and `compiled-scene-plan.json` persisted per project.
- Result: overlay and full-scene rendering now compile from the same block-based plan, template capabilities are resolved before planning, and saved block-scene decisions survive rerenders until transcript/EDL invalidation.
- Follow-up: server-side end-to-end render fixtures still need real media fixtures if we want artifact-level validation beyond planner/compiler coverage.

### 2026-06-15 — Block-level review now edits scene decisions instead of planner chips

- Problem: review only exposed a shallow planner summary (`beats.slice(0, 10)`), so users could not adjust generated scenes per semantic block without falling back to template switching or text edits.
- Decision: add `BlockReviewPanel`, `SceneRecipePicker`, and `/api/projects/[id]/scene-blocks`, with block-scoped actions for regenerate/change/simplify/strengthen/layer disable/speaker show-hide/safe mode. Persist changes into `scene-plan.json` and invalidate derived render assets before rerender.
- Result: review UI now works on stable `blockId` / `layerId` scene decisions rather than raw timing edits, matching the target architecture from the spec.
- Follow-up: add visual thumbnails/clips per block once the project has a stable fragment preview cache.

### 2026-06-15 — Validation status after scene-pipeline migration

- Problem: the spec requires `pnpm typecheck`, `pnpm lint`, and `pnpm build`, but full-repo lint currently fails on long-standing files outside the migrated scene pipeline.
- Decision: run full validation commands anyway, then isolate the blocker by linting all new and touched scene-pipeline files separately.
- Result: `pnpm typecheck` passed, `pnpm build` passed, fixture-level planner/compiler validation passed, and all new/touched scene-pipeline files lint clean. Full `pnpm lint` still fails because of unrelated legacy errors in template-builder preview files, HyperFrames AIS renderers, old visual planner/director modules, and `patch_*.js`.
- Follow-up: repo-wide lint cleanup is still required before the final Definition of Done checkbox `All validation checks pass` can be marked complete.

### 2026-06-05 — Template builder preview pinned above scrolling controls

- Problem: `/templates/new` could clip the preview area and the sticky behavior was unstable because the preview lived inside the same constrained grid flow as the rest of the controls.
- Decision: split the page into a dedicated sticky preview block plus a separate content grid below for categories and controls, and remove preview height clipping from the container.
- Result: the preview stays visible while the rest of the builder scrolls beneath it on mobile and desktop layouts.
- Follow-up: verify the live server layout in a real mobile browser after deploy and tune the sticky top offset only if Safari safe-area behavior needs it.

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

### 2026-06-06 — Template builder mobile scroll now moves only the panel below the preview

- Problem: `/templates/new` on mobile pinned the preview, but the lower controls stopped scrolling because overflow lived on the wrong inner container and prod still served stale Next assets from a deleted standalone build directory.
- Decision: move the mobile overflow to the main shell below the fixed preview, remove the extra inner `contentGrid` scroll on mobile, rebuild the app, and restart the live Next.js process from the fresh `.next/standalone` directory so the page serves the new asset hashes.
- Result: on mobile the preview stays fixed while the sections and controls below it scroll as one block; browser verification showed `shellScrollTop` changing while `previewTop` stayed fixed.
- Follow-up: clean up the temporary compatibility asset copies that were created earlier for stale hashes once the deployment path is fully stable.

### 2026-06-06 — Template builder color controls now use an iPhone-style bottom sheet picker

- Problem: the old `/templates/new` color fields used native color inputs with no consistent mobile UX, no spectrum mode, and no slider mode; the first sheet implementation also lived inside the scrolled builder container and behaved incorrectly.
- Decision: add `@uiw/react-color`, move color picking into a dedicated `TemplateColorPicker` component, render the picker as a portal-backed bottom sheet, and expose three tabs: grid, spectrum, and sliders. Keep recent swatches and live preview updates while editing.
- Result: the builder now opens a mobile-first color sheet with `Сетка / Спектр / Слайдеры`, recent colors, alpha-aware values, and immediate preview updates for text/accent/surface colors.
- Follow-up: later persist recent colors per user/template instead of browser-local storage only, and localize the remaining `Hue / Saturation / Brightness / Opacity` labels if the builder becomes fully Russian-only.

### 2026-06-15 — Scene composition engine reached spec-complete validation state

- Problem: the new block-based scene pipeline was implemented, but the task could not be marked complete while repo-wide lint still failed on legacy template-builder and AIS renderer files outside the migrated path.
- Decision: finish the scene architecture migration, then remove the remaining lint/type contract debt in the shared template-builder, AIS renderer, and visual planner boundaries instead of treating those failures as out-of-scope.
- Result: the app now validates cleanly with `pnpm lint`, `pnpm build`, and `pnpm typecheck`; the spec checklist is fully closed, and the scene composition engine runs through template-backed semantic blocks, constrained AI scene plans, deterministic compilation, overlay composition, full-scene composition, and block-level review.
- Follow-up: deploy this branch to `/opt/montazhor` and run the server-side release checklist if production verification is required in the same cycle.

### 2026-06-15 — Server OOM on block-scene review render

- Problem: the last server project entered the new block-based scene pipeline successfully, but the review render was OOM-killed during overlay fragment rendering after the cinematic scene pass completed.
- Decision: keep the new architecture intact and apply a safe server-side downgrade only to overlay fragment concurrency. Default `HYPERFRAMES_OVERLAY_FRAGMENT_CONCURRENCY` is now `1`, with env override support up to `3`.
- Result: the failure mode moves from process-killing memory spikes to slower but stable overlay fragment rendering on constrained server memory.
- Follow-up: if the server memory budget increases later, raise `HYPERFRAMES_OVERLAY_FRAGMENT_CONCURRENCY` explicitly instead of changing code defaults back.

### 2026-06-15 — Server OOM on final overlay compose

- Problem: after lowering fragment concurrency, the same project still OOM-killed the service later in the pipeline when FFmpeg tried to overlay too many pre-rendered fragment inputs in one huge `filter_complex`.
- Decision: keep the scene/block render architecture unchanged, but downgrade only the overlay compose implementation to batched passes. The default `HYPERFRAMES_OVERLAY_COMPOSE_BATCH_SIZE` is now `6`, with env override support up to `12`.
- Result: the final overlay compose no longer needs one memory-explosive FFmpeg graph over all fragments at once; it can progress through bounded batches on the current server.
- Follow-up: if we later add a true streamable compositor or a much larger server memory budget, we can revisit the batch size without changing planner/compiler behavior.

### 2026-06-15 — Montage cleanup for duplicated inserts and hiss

- Problem: the new scene path produced ugly repetition because one semantic block was compiled into many identical overlay cards, and the review path then burned a separate subtitle pass over the same spoken text layer. Audio also degraded because intermediate overlay-compose passes repeatedly re-encoded AAC.
- Decision: change the overlay compiler so each block gets one primary semantic insert plus limited speech-support beats instead of repeated identical cards; skip standalone subtitle burn when scene composition already owns the spoken text layer; copy audio through intermediate overlay-compose passes instead of re-encoding it every time.
- Result: the visual direction is closer to editorial montage instead of duplicated cards, and the audio path removes the most obvious source of hiss accumulation.
- Follow-up: if some recipes still feel too static after this, tune recipe-specific support-beat behavior rather than reintroducing generic repeated panel triggers.

### 2026-06-15 — Deterministic montage rebalancing between adjacent scene blocks

- Problem: even after removing within-block duplicates, the block planner could still assign the same recipe to neighboring semantic blocks, which made the montage feel like the same card was being replayed with only different text.
- Decision: add a deterministic rebalance pass in `scenePlanner` that swaps adjacent repeated recipes to a compatible alternative from the shared scene library whenever the template allows it, including safe fallback-recipe alternation for tightly repeated endings and list/proof runs.
- Result: scene plans now keep the same semantic intent while varying neighboring mise-en-scene instead of stacking identical checklist/CTA/comparison treatments back to back.
- Follow-up: if needed later, add recipe-specific layout alternation on top of this so repeated fallback-only cases can still vary position and framing without changing block semantics.

### 2026-06-15 — Scene-plan cache now invalidates on planner-version change

- Problem: the new montage rebalance logic was present in code, but `renderScenePipeline` reused an old `scene-plan.json` whenever semantic block ids and template id matched, so behavior changes in the planner could be silently ignored on rerender.
- Decision: version the planner output explicitly (`SCENE_PLAN_VERSION`, currently `v3`) and reject reusable scene-plan artifacts whose saved `version` no longer matches the current planner logic.
- Result: rerenders now rebuild the scene plan when planner behavior changes, instead of serving stale block recipes from a previous architecture revision.
- Follow-up: if scene-compiler compatibility changes become more frequent, add the same explicit version gate for any future reusable compiled-scene-plan layer as well.

### 2026-06-15 — Cinematic baseline restored inside the new scene engine

- Problem: the new block-based scene pipeline kept the right architecture, but it had drifted away from the strongest 2026-06-14 cinematic behavior: deterministic recipe choice became too flat, some full-scene payloads no longer matched the old AIS cinematic renderer, and speaker compositing still treated `layoutMode` as if every `full_frame` scene needed a PIP box.
- Decision: keep the current scene-engine architecture, but reintroduce the strongest old cinematic heuristics as a focused deterministic recipe selector, trim duplicate subtitle/title payloads, normalize full-scene payloads for AIS renderer contracts, and drive speaker-box compositing from `speakerMode` instead of blindly from `layoutMode`.
- Result: the current build now preserves the newer scene-library/compiler pipeline while regaining more varied scene choice, better timeline/card/trust-map payloads, less duplicate on-screen text, and safer speaker placement in full-scene compositions.
- Follow-up: validate this branch on the remote `/opt/montazhor` runtime with a known-good talking-head fixture and tune any remaining layout defects per recipe instead of broad planner changes.
