# Visual Overlay Next-Agent Notes

Purpose: continue the visual overlay work without re-opening solved problems.

## Current State

The app now uses a continuous semantic visual overlay path instead of sparse subtitle/card inserts.

Deployed on production server:

- Server path: `/opt/montazhor`
- Host: `45.147.177.53`
- Runtime service: `montazhor.service`

SSH access:

- Do not store the server password, private keys, or API keys in tracked files.
- The local Mac should have its public key installed in `/root/.ssh/authorized_keys` on the server.
- Prefer key-based login:

```bash
ssh root@45.147.177.53
```

- If password access is needed, read it only from the untracked local `.env.server-access` file or ask Nikita. Do not paste the password into `AGENTS.md`, docs, commits, logs, or code.

Important modules:

- `server/ai/visualPlanner.ts` builds a continuous visual plan from cleaned subtitles and merges AI upgrades into that plan.
- `server/ai/visualPayload.ts` builds safe payloads and trims text for each template.
- `server/hyperframes/visualRegistry.ts` defines visual templates, style profiles, and preset definitions.
- `server/hyperframes/visualLayoutPreflight.ts` validates and normalizes beats before render.
- `server/hyperframes/templates/SemanticOverlay.ts` renders the deterministic HyperFrames overlay.
- `server/hyperframes/semanticOverlay.ts` renders overlay video and composites it over `clean.mp4`.
- `server/hyperframes/render.ts` handles Docker/local HyperFrames execution and fallback.
- `lib/visualStyleOptions.ts` parses saved style options from `Project.styleOptionsJson`.
- `app/components/StyleStudio.tsx` exposes visual density, motion, preset pack, and disabled template controls.

## What Is Already Done

- Continuous visual coverage: ordinary speech is represented with `kinetic_text`.
- Contextual upgrades: numbers, warnings, lists, definitions, comparisons, and CTAs map to stronger templates.
- Preset registry: reusable presets exist for kinetic phrases, keyword slams, numbers, charts, checklists, cards, definitions, comparisons, and CTAs.
- Preflight: long kinetic phrases are split, text is clamped, disabled templates are respected, and unsafe beats fall back to `kinetic_phrase_safe`.
- Renderer fallback: Docker render falls back to local HyperFrames/Chrome if Docker is unavailable.
- Alpha attempt: alpha WebM is attempted, then verified with `ffprobe`; if no alpha channel is present, the system falls back to chroma key.
- Server validation passed: typecheck, lint, build, HyperFrames inspect, health check, and end-to-end `renderSemanticOverlay` on a synthetic clean video.

## Known Limitations

- HyperFrames WebM on the current server renders as `yuv420p`, so true alpha is not available yet. The app safely falls back to chroma key.
- The preset catalog is functional, not final art direction. It needs more designed, reference-quality presets.
- UI controls expose preset pack/density/motion and disabled templates, but there is no visual preset gallery with per-preset previews yet.
- Face-safe zones are not detected from video. Current safe areas are generic portrait/landscape bounds.
- Render failure isolation is still overlay-level, not per-segment fragment caching.

## Next Work

1. Add true alpha output support.
   Verify whether a newer HyperFrames version or render flag can produce VP9/ProRes with alpha on the Beget server. Do not remove chroma fallback until `ffprobe` confirms an alpha pixel format such as `yuva420p`.

2. Expand preset quality.
   Build 20-40 polished production presets in `visualRegistry.ts` and `SemanticOverlay.ts`. Use the local HyperFrames library first:
   - `hyperframes-library/projects/studio-demo`
   - `hyperframes-library/library/official`
   - `hyperframes-library/library/community/hyperframes-student-kit`

3. Add visual preset preview UI.
   Extend `StyleStudio` or add a focused preset catalog screen. The user should see what packs/presets mean before rendering.

4. Add face-aware layout.
   Introduce optional face/speaker-safe regions, then pass them into `visualLayoutPreflight.ts` so overlays avoid the speaker's face instead of using only generic safe areas.

5. Add per-segment render isolation.
   Split long overlay renders into fragments or scene groups, cache successful fragments, and replace failed fragments with safe kinetic overlays instead of retrying the whole overlay.

6. Improve AI prompt contract.
   Include `preset_registry` in the AI prompt, require `presetId`, and reject AI beats that choose templates without an allowed preset. AI must remain a selector, not a free-form designer.

## Required Checks

Run locally when touching these modules:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Run on server before calling the work done:

```bash
cd /opt/montazhor
pnpm typecheck
pnpm lint
pnpm build
bash scripts/prepare_standalone_release.sh
systemctl restart montazhor
bash scripts/ensure_runtime_healthy.sh
```

Run HyperFrames layout validation on a synthetic composition:

```bash
cd /opt/montazhor
PRODUCER_BROWSER_GPU_MODE=software pnpm exec hyperframes inspect /tmp/montazhor-visual-v2-final-test --samples 8 --json
```

Expected result: `ok: true`, `issueCount: 0`.

Run end-to-end overlay validation after render changes:

```bash
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,duration -of compact=p=0:nk=1 /tmp/montazhor-overlay-e2e/final.mp4
```

Expected result: H.264 video at `1080x1920` and AAC audio.

## Rules

- Do not revert to sparse visual beats.
- Do not let AI invent templates, CSS systems, fonts, colors, or effects outside the registry.
- Do not trust alpha output by file extension; verify pixel format with `ffprobe`.
- Do not render the clean/source video inside HyperFrames unless an alpha-capable source-video render path has been introduced and validated.
- Keep final export working even if HyperFrames fails.
- Update `docs/process-work-log.md` after meaningful implementation or deploy work.
