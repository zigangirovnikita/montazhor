# HyperFrames Motion Library Plan

This document is the working shortlist for reusable visual assets around HyperFrames:

- fonts for subtitles and overlays;
- text animation patterns;
- standard infographic and CTA motion elements;
- sources and libraries we can legally and practically adapt into local templates.

The goal is to build a local reusable motion library that does not require LLM tokens for rendering. Tokens should only be used later for optional content adaptation or template selection.

## Core Principle

If a template is already described in HTML/CSS/GSAP/Lottie/SVG code, HyperFrames can render it locally without OpenRouter token usage.

That means we can safely build:

- many subtitle presets;
- many infographic templates;
- reusable CTA and reaction elements;
- reusable transitions;
- reusable accent animations.

## Recommended Asset Stack

Use this order of priority:

1. `GSAP` for core deterministic motion inside HyperFrames.
2. `CSS keyframes` for simple repeated motion and low-complexity effects.
3. `Lottie` for icon-like decorative animations and compact motion stickers.
4. `SVG` for arrows, lines, markers, callouts, charts, badges, and simple shape morphs.
5. `HyperFrames registry` for ready-made blocks, transitions, overlays, and patterns.

## Fonts Starter Pack

These should be added gradually, tested for Cyrillic support first, and used as local assets:

1. `Manrope`
2. `Onest`
3. `Unbounded`
4. `Montserrat`
5. `Inter`
6. `IBM Plex Sans`
7. `Rubik`
8. `Golos Text`
9. `Space Grotesk`
10. `Bebas Neue`

Recommended role split:

- `Manrope`, `Onest`, `Inter`, `Golos Text` for readable subtitles;
- `Montserrat`, `Rubik`, `IBM Plex Sans` for clean infographic labels;
- `Unbounded`, `Space Grotesk`, `Bebas Neue` for hooks, numbers, CTA, accents.

## Text Animation Presets

Initial subtitle and text animation pack:

1. word-by-word fade in
2. word-by-word pop in
3. current spoken word highlight
4. current spoken word marker sweep
5. phrase slide-up reveal
6. phrase blur-to-sharp reveal
7. kinetic headline with stagger
8. bounce emphasis on keyword
9. scale pulse on active word
10. handwriting underline or circle accent

These should become reusable HyperFrames templates rather than one-off compositions.

## Standard Motion Elements

Initial reusable non-AI motion library:

1. big number counter
2. growing bar chart
3. animated line chart
4. progress line between points
5. arrow from text to object
6. checklist with sequential reveals
7. warning badge or alert plate
8. quote card
9. comparison card before/after
10. subscribe button animation
11. like or save CTA animation
12. emoji reaction burst
13. rating stars or score meter
14. timeline with moving pointer
15. speech bubble or callout label

## HyperFrames-Specific Sources

Use these first because they match the rendering model best:

- official HyperFrames docs for GSAP, captions, transitions, and adapters;
- official HyperFrames registry blocks via `hyperframes add <slug>`;
- official HyperFrames examples and catalog patterns;
- HyperFrames-compatible adapters for `GSAP`, `Lottie`, `Anime.js`, `WAAPI`, and `CSS`.

Practical use:

- inspect registry blocks for transitions, overlays, charts, and cinematic patterns;
- adapt examples into local project templates;
- keep customizations inside our own `server/hyperframes/templates/` layer.

## External Open Sources To Reuse

These are the most useful sources for a first local asset library:

### Motion engines

- `GSAP` as the main motion engine for premium text and UI animation.
- `Anime.js` for simpler alternative timelines when useful.
- `Open Props` for reusable easings, timing tokens, and small CSS animation helpers.

### Decorative and icon motion

- `LottieFiles` for public Lottie animations such as CTA buttons, reactions, arrows, badges, and stickers.
- public `SVG` icon packs for badges, arrows, chart elements, and UI accents.

### Design inputs

- open font libraries with Cyrillic support;
- open icon packs;
- open SVG illustration packs where styles are clean enough for short-form video.

## Licensing Notes

Before importing assets into the production library, check:

- license allows commercial use;
- fonts support Cyrillic if we use Russian subtitles;
- animation files can be redistributed inside the project if needed;
- branding or character assets do not carry editorial restrictions.

Do not treat every free website asset as automatically safe for bundling.

## What To Build First

Phase 1 should stay practical and small:

1. 5 strong subtitle presets
2. 5 hook or headline text presets
3. 5 infographic widgets
4. 3 CTA patterns
5. 3 reaction or emotion motifs
6. 3 cut transitions

After these are stable, expand toward the larger target library.

## Recommended First Pack

If we want the fastest useful result, build this first:

- Fonts: `Manrope`, `Onest`, `Unbounded`, `Montserrat`, `Golos Text`
- Subtitle presets:
  - clean expert
  - premium glow
  - active word highlight
  - marker sweep
  - viral punch
- Infographic widgets:
  - big number
  - checklist
  - quote card
  - warning card
  - line chart
- CTA:
  - subscribe
  - save this
  - follow for part 2
- Reactions:
  - surprise
  - approval
  - urgency
- Transitions:
  - white flash
  - directional blur whip
  - punch zoom cut

## Transition Strategy

For transitions between adjacent author cuts:

- use `FFmpeg` for very simple hard transitions and safe production glue;
- use `HyperFrames` when the transition must be visual, branded, stylized, or synchronized with overlays;
- for CapCut-like flash, whip, blur, punch, glow, freeze-frame accent, and graphic overlays, HyperFrames is the better long-term layer.

Reason:

- `FFmpeg` is better at fast, stable, low-level media operations;
- `HyperFrames` is better at intentional designed motion, layered graphics, text-linked transitions, and reusable visual presets.

Recommended rule:

- basic editing and media transforms stay in `FFmpeg`;
- premium visual transitions become reusable `HyperFrames` templates.

## Next Expansion Direction

After the first library works, expand toward:

- niche-specific themes;
- branded subtitle packs;
- better infographic template families;
- AI-assisted template selection;
- AI-assisted card text compression and headline generation.
