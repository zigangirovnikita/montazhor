Official HyperFrames registry assets installed into this repo.

Installed components:
- `grain-overlay` — light film grain overlay for subtle texture.
- `shimmer-sweep` — accent sweep for cards and CTA surfaces.
- `caption-highlight` — TikTok-like active-word highlight.
- `caption-kinetic-slam` — aggressive single-word punch captions.
- `caption-pill-karaoke` — karaoke pill captions for readable mobile subtitles.

Installed blocks:
- `ui-3d-reveal` — product/UI showcase reveal.
- `transitions-destruction` — break-apart transition showcase.
- `vfx-shatter` — experimental glass/shatter VFX block.

Why these were chosen:
- They map to the current product: talking-head cleanup, mobile subtitles, CTA cards, and occasional motion inserts.
- They are official registry items, so we can study and adapt their HTML/CSS/JS instead of inventing effects from scratch.
- They are a safer starting set than importing the full public catalog, which includes many demo-only blocks not aligned with the app flow.

Recommended integration order:
1. Upgrade subtitle rendering by adapting `caption-highlight` or `caption-pill-karaoke` into `server/hyperframes/templates/SubtitlesOverlay.ts`.
2. Upgrade CTA and key-point cards by borrowing parts of `shimmer-sweep`.
3. Add one controlled motion-insert path based on `ui-3d-reveal`.
4. Add optional experimental transitions/VFX only behind a feature flag or planner rule.

Important:
- These files are source assets from the official HyperFrames registry. They are not wired into the app automatically.
- `vfx-shatter` and destructive transitions are visually strong and should be used rarely in a talking-head autopilot.
