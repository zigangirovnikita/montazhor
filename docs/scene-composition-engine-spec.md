# Scene Composition Engine Spec

## Purpose

This spec defines the target architecture and execution rules for the visual generation system of Montazhor.

Goal:

Turn the current "overlay beats with occasional AI upgrades" pipeline into a full scene composition engine that:

- keeps one consistent visual identity per video;
- uses reusable scene recipes instead of generating design from scratch;
- lets AI choose scene intent and semantic structure;
- keeps final layout/render deterministic;
- supports both overlay scenes and full-scene compositions;
- provides block-level review instead of a timeline editor.

This document is written so an implementation agent can use it as an end-to-end build plan and should not stop until every required phase, acceptance criterion, and validation check is complete.

## Non-Negotiable Product Decisions

These decisions are fixed and must not be re-opened during implementation:

- One visual style per video.
- Visual style source of truth is the user-selected template from the template builder.
- Scene library is shared globally across templates.
- AI does not generate layouts from scratch.
- AI returns `scene plan`, not exact coordinates or final animation code.
- Planning is block-based, not phrase-by-phrase.
- Inside each block, speech must still get continuous visual confirmation through micro-beats.
- AI may combine `2-3` compatible layers in one scene, but only via explicitly allowed recipe composition rules.
- Both render categories are required:
  - `overlay scenes`
  - `full-scene compositions`
- No external asset search.
- Future local asset bank is allowed and should be anticipated by architecture, but is not phase-1 scope.
- User control surface is `block-level review`, not a manual timeline editor.
- Future voice-command editing must be possible through addressable scene/block/beat IDs.

## Execution Policy For The Implementing Agent

The implementing agent must follow this policy:

- Treat this document as the active delivery contract.
- Do not stop after partial architecture changes.
- Do not stop after docs-only work.
- Do not stop after one render path is done if the other required path is still missing.
- Do not declare success while any checklist item in any phase remains unchecked.
- After each completed phase, update this spec by marking completed checklist items.
- After each meaningful code change, update `docs/process-work-log.md`.
- Before finishing, run all validation commands in the Validation section.
- If blocked by a real technical constraint, document:
  - exact blocker;
  - attempted fixes;
  - affected checklist items;
  - safest fallback that keeps the product usable.
- "Looks better" is not a completion criterion. Only checklist completion and validation count.

## Target Outcome

After implementation, the pipeline must work like this:

1. Video is cleaned and transcript timings are finalized.
2. The cleaned transcript is grouped into semantic blocks.
3. AI plans scenes per block using a constrained scene vocabulary and shared recipe library.
4. AI also plans micro-beats inside each block so visuals confirm spoken meaning continuously.
5. A deterministic compiler converts the scene plan into exact HyperFrames-ready composition data.
6. The render layer can produce:
   - overlay-only scenes over talking-head video;
   - split/pip/full-graphic scenes that restructure the frame.
7. The user can review generated scenes at block level and regenerate or simplify them without touching a timeline.

## Current Architectural Gap

Current code already contains:

- visual presets;
- visual planner;
- HyperFrames overlay rendering;
- style/template builder;
- preflight and validation.

But the system is still structurally incomplete because:

- presets are closer to visual blocks than a full scene library;
- planner is still beat-oriented instead of `block -> scene -> micro-beats`;
- template builder has not fully become the visual source of truth for the entire pipeline;
- overlay rendering exists, but full-scene composition is not formalized as a separate rendering path;
- UI is still oriented around style toggles rather than generated scene review.

## Architecture To Build

The new system must contain these layers:

1. `Template System`
2. `Scene Library`
3. `Semantic Block Planner`
4. `LLM Scene Planner`
5. `Deterministic Scene Compiler`
6. `Micro-Beat Engine`
7. `Render Orchestrator`
8. `Block-Level Review UI`

## Layer 1: Template System

The template system must become the visual source of truth.

### Responsibilities

- Define palette, typography, surfaces, borders, shadows, motion language, transitions, composition tone, and safe layout behavior.
- Define which scene recipes and variants are allowed for the selected template.
- Define how a shared scene recipe is skinned for this author/style.
- Persist enough information so future renders reproduce the same style deterministically.

### Required Behavior

- Preserve `visualTemplateId` and template-derived settings in `styleOptionsJson`.
- Do not reduce the selected template to only `presetPack/density/motion`.
- Keep `presetPack/density/motion/disabledTemplates` as derived or fallback compatibility fields, not primary truth.
- Allow shared scene recipes to render differently under different templates while preserving recipe semantics.

### Acceptance Criteria

- [x] Selected template survives project create, update, render, and review flows without loss.
- [x] Template-derived scene restrictions affect planning and rendering.
- [x] Existing non-template projects still render through safe fallback mapping.

## Layer 2: Scene Library

The project needs a real scene library, not only a preset list.

### Required Scene Categories

- `overlay_scene`
- `split_scene`
- `pip_scene`
- `full_graphic_scene`
- `camera_emphasis_scene`
- `transition_scene`

### Required Initial Scene Recipes

Minimum first-pass recipe set:

- `hook_title_left`
- `hook_title_center`
- `big_number_grow`
- `big_number_plus_text_plate`
- `myth_vs_truth`
- `definition_card`
- `comparison_split`
- `checklist_reveal`
- `timeline_year_callout`
- `trust_diagram`
- `quote_emphasis`
- `cta_finish`
- `speaker_lower_half_top_visual`
- `speaker_right_panel_left_infographic`
- `voiceover_full_graphic`
- `camera_punch_in`
- `clean_section_transition`

### Each Recipe Must Define

- stable recipe ID;
- scene category;
- compatible templates or capability flags;
- allowed layer combinations;
- allowed layouts;
- payload schema;
- duration constraints;
- micro-beat capacity;
- fallback recipe if invalid;
- whether speaker video is:
  - full-frame;
  - cropped/reframed;
  - pip;
  - hidden.

### Acceptance Criteria

- [x] Shared scene library exists as a first-class module.
- [x] Recipes are explicit, typed, and validated.
- [x] Template can allow/deny recipes without duplicating them.
- [x] Recipes support controlled `2-3` layer combinations.

## Layer 3: Semantic Block Planner

The system must introduce a block planning layer before scene planning.

### Responsibilities

- Group cleaned transcript into semantic blocks.
- Detect block intent from context, not only token patterns.
- Preserve relation between words, phrases, and their parent block.

### Required Block Types

At minimum:

- `hook`
- `thesis`
- `explanation`
- `definition`
- `example`
- `comparison`
- `myth_vs_truth`
- `proof`
- `timeline`
- `list`
- `warning`
- `cta`
- `transition`

### Important Rule

This layer must not over-constrain scene choice.

It should produce a semantic envelope, not force a final recipe too early.

### Acceptance Criteria

- [x] Every cleaned video is segmented into ordered semantic blocks.
- [x] Blocks are linked to exact transcript spans and word timings.
- [x] Blocks preserve enough context for downstream scene selection.

## Layer 4: LLM Scene Planner

AI must choose scene intent first, but inside strict guardrails.

### AI Inputs

- cleaned transcript;
- word timings;
- semantic blocks;
- content plan;
- selected template capabilities;
- allowed scene recipes;
- allowed layer combinations;
- safe layout capabilities;
- future asset-bank metadata placeholder.

### AI Outputs

For each block, AI returns a `ScenePlanBlock` with:

- `blockId`
- `blockType`
- `sceneCategory`
- `recipeId`
- `variantId` if applicable
- `speakerMode`
- `layerPlan`
- `microBeats`
- `intensity`
- `transitionIn`
- `transitionOut`
- optional rationale for logs/debugging

### Micro-Beats

Micro-beats must be anchored to words, short phrases, or subranges within the block.

Allowed examples:

- number emphasis;
- keyword highlight;
- portrait/image placeholder intent for future local assets;
- chart tick;
- label reveal;
- checklist row reveal;
- strike-through;
- subtitle phrase emphasis;
- panel state change;
- camera push/reframe;
- icon/shape pop;
- background state shift.

### Forbidden AI Behaviors

- invent new recipe IDs;
- invent new layout systems;
- return exact coordinates as source of truth;
- ignore template restrictions;
- exceed allowed layer combinations;
- create static 4-5 second scenes with no internal changes;
- inject visual text that drifts from spoken meaning.

### Acceptance Criteria

- [x] AI returns scene plans only from allowed vocabulary.
- [x] AI output is schema-validated.
- [x] Invalid AI plans downgrade safely instead of breaking render.
- [x] Logs clearly show chosen blocks, recipes, and fallbacks.

## Layer 5: Deterministic Scene Compiler

This is the main stabilizer of the system.

### Responsibilities

- Convert scene plan into deterministic render instructions.
- Resolve layout, positioning, sizing, line wrapping, timing, and motion.
- Respect template style system.
- Resolve safe zones and speaker placement.
- Downgrade unsafe scenes into safe variants.

### Compiler Must Decide

- final positions;
- typography scaling;
- face-safe or speaker-safe placement;
- motion timing;
- line wrapping;
- layer stacking;
- fallback recipe substitution;
- shortening by beat splitting, never by unsafe clipping with ellipses for main text.

### Acceptance Criteria

- [x] Same input scene plan produces stable output.
- [x] Long text degrades safely.
- [x] Invalid layers or layouts do not crash render.
- [x] Compiler can target both overlay and full-scene paths.

## Layer 6: Micro-Beat Engine

The system must keep internal motion alive inside a scene block.

### Rule

If a scene state remains visually unchanged for longer than about `3s`, the planner/compiler path is considered insufficient and must:

- inject a safe micro-state change;
- or replan/downgrade the block.

### Desired Beat Rhythm

Within a block, visible changes should typically happen every `0.5–2.0s`, depending on speech density.

### Valid Changes

- reveal;
- highlight;
- chart progression;
- number growth;
- swap card state;
- strike line;
- label entry;
- icon entry;
- camera push/reframe;
- background pulse/shift;
- subtitle emphasis;
- panel focus change.

### Acceptance Criteria

- [x] Static scene states longer than allowed threshold are detected.
- [x] Micro-beat generation is tied to spoken content, not random animation spam.
- [x] Overlay and full-scene recipes both support internal state changes.

## Layer 7: Render Orchestrator

Two rendering paths must exist explicitly.

### Required Paths

1. `Overlay Render Path`
   - video remains base layer;
   - visual scene overlays on top;
   - supports talking-head-centric compositions.

2. `Full-Scene Composition Path`
   - scene may take over frame;
   - speaker may move, shrink, crop, become pip, or disappear;
   - audio continues from clean video;
   - may render graphic-only segments with speaker voice off-camera.

### Required Scene Behaviors

- speaker lower-half with upper infographic;
- speaker side panel plus large data area;
- full-screen graphic explanation with voiceover only;
- transitions between talking-head and graphic scenes;
- aggressive speaker emphasis scenes such as punch-in/reframe;
- split-screen narrative scenes.

### Acceptance Criteria

- [x] Overlay path remains stable.
- [x] Full-scene path exists as separate architecture, not hacked into overlay logic.
- [x] Switching between scene categories preserves sync and export stability.

## Layer 8: Block-Level Review UI

The user must be able to review and correct scene planning without opening a timeline editor.

### Required UI Behavior

For each semantic block show:

- block text summary;
- time range;
- chosen scene category;
- chosen recipe;
- active layers;
- preview thumbnail or clip;
- actions.

### Required Actions

- `regenerate block`
- `change scene`
- `simplify scene`
- `make stronger`
- `disable layer`
- `bring speaker back`
- `hide speaker for this block`
- `switch to safe mode`

### Important Constraint

This is not a manual timeline editor.

The UI edits scene-plan decisions, not raw frame cuts.

### Acceptance Criteria

- [x] Generated blocks are reviewable individually.
- [x] User can change block scene decisions without low-level timeline editing.
- [x] Changes invalidate and rerender affected derived assets correctly.

## Future-Ready Requirement: Voice Command Layer

Not required in the first implementation phase, but the architecture must support it.

### Required Precondition

Every generated element must be addressable by stable IDs:

- `blockId`
- `sceneId`
- `layerId`
- `beatId`

### Reason

This enables future commands such as:

- "at 3 seconds make this brighter"
- "remove the insert at 10 seconds"
- "change this block to a graph scene"
- "keep only the speaker here"

### Acceptance Criteria

- [x] Internal scene plan structures are addressable and patchable by ID.

## Suggested File-Level Refactor Direction

The exact file names may vary, but the implementation should converge toward a structure like:

- `server/scene/scenePlanSchema.ts`
- `server/scene/sceneLibrary.ts`
- `server/scene/sceneCompiler.ts`
- `server/scene/sceneCompatibility.ts`
- `server/scene/blockPlanner.ts`
- `server/scene/microBeatPlanner.ts`
- `server/scene/renderModes.ts`
- `server/scene/fullSceneComposer.ts`
- `server/scene/overlayComposer.ts`
- `server/ai/scenePlanner.ts`
- `server/ai/scenePlannerPrompts.ts`
- `server/hyperframes/templates/scenes/*`
- `app/components/BlockReviewPanel.tsx`
- `app/components/SceneRecipePicker.tsx`

Existing modules that likely need integration or restructuring:

- `server/ai/visualPlanner.ts`
- `server/ai/timedVisualSegments.ts`
- `server/hyperframes/visualRegistry.ts`
- `server/hyperframes/visualLayoutPreflight.ts`
- `server/hyperframes/templates/SemanticOverlay.ts`
- `server/pipeline/renderProject.ts`
- `lib/templateBuilder.ts`
- `app/components/StyleStudio.tsx`
- `app/components/TemplatePicker.tsx`

## Delivery Phases

Implementation must be done in this order unless a dependency forces minor reordering.

### Phase 1: Promote Template System To Source Of Truth

- [x] Make template-backed style data survive the full project lifecycle.
- [x] Stop treating `presetPack/density/motion` as the main truth.
- [x] Ensure render pipeline receives template capabilities directly.

### Phase 2: Introduce Semantic Blocks

- [x] Build block segmentation layer.
- [x] Connect blocks to transcript words and timings.
- [x] Preserve backward compatibility with current subtitle/visual data.

### Phase 3: Build Shared Scene Library

- [x] Create first-class scene recipe definitions.
- [x] Encode category, compatibility, layers, payloads, and fallbacks.
- [x] Re-map existing useful presets into recipe-backed structure.

### Phase 4: Replace Beat-First AI Planner With Scene Planner

- [x] Add AI scene-planning prompt and schema.
- [x] Make AI output block scene plans and micro-beats.
- [x] Add strict validation and safe downgrade behavior.

### Phase 5: Build Deterministic Scene Compiler

- [x] Compile scene plan into exact render instructions.
- [x] Support template-aware layout and motion resolution.
- [x] Add static-scene detection and safe micro-state injection or downgrade.

### Phase 6: Stabilize Overlay Render Path

- [x] Port current overlay rendering onto compiled scene instructions.
- [x] Keep sync, readability, and fallback behavior stable.

### Phase 7: Add Full-Scene Composition Path

- [x] Add render mode for split/pip/full-graphic scenes.
- [x] Support speaker reposition/hide/show logic.
- [x] Preserve clean audio and source orientation.

### Phase 8: Add Block-Level Review UI

- [x] Show generated scene blocks in review UI.
- [x] Allow block-scoped regeneration and simplification.
- [x] Ensure rerender invalidation is correct.

### Phase 9: Hardening

- [x] Add logs for block planning, recipe choice, downgrade, and render mode choice.
- [x] Add regression coverage for both overlay and full-scene outputs.
- [x] Update docs and process log.

Notes:

- 2026-06-15: `server/scene/*`, `server/ai/scenePlanner.ts`, and `app/components/BlockReviewPanel.tsx` now drive the primary scene pipeline. Overlay and full-scene composition both compile from the same `scene-plan.json` source.
- 2026-06-15: Repo-wide lint debt in legacy template-builder and AIS renderer files was cleaned up so the migrated scene pipeline now passes the same full validation gates as the rest of the app.

## Definition Of Done

Implementation is complete only when all statements below are true:

- [x] Template builder is the real visual source of truth.
- [x] Scene planning happens by semantic block.
- [x] AI outputs constrained scene plans, not raw layouts.
- [x] Shared scene library exists and is actually used.
- [x] Overlay scenes render through the new plan/compiler path.
- [x] Full-scene compositions render through a separate path.
- [x] Micro-beats keep scenes visually active.
- [x] Block-level review UI exists and works.
- [x] Invalid scene plans downgrade safely.
- [x] Existing project flow remains usable.
- [x] Docs and logs are updated.
- [x] All validation checks pass.

If any item above is still false, the agent must not mark the task done.

## Validation

Run all of the following before completion:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

If rendering code changed, also validate scene rendering with representative fixtures for:

- overlay-only block sequence;
- split-scene block;
- full-graphic voiceover block;
- transition into and out of full-scene mode.

Validation status on 2026-06-15:

- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm build` — passed.
- Representative fixture validation — passed at planner/compiler level via `pnpm exec tsx -e "...buildDeterministicScenePlan/compileScenePlan..."`, covering overlay, split-scene, full-graphic, and transition cases.

If deploying to the server as part of the task:

```bash
cd /opt/montazhor
pnpm typecheck
pnpm lint
pnpm build
bash scripts/prepare_standalone_release.sh
systemctl restart montazhor
bash scripts/ensure_runtime_healthy.sh
```

## Required Progress Tracking

While implementing, the agent must use this document as a live checklist:

- mark completed phase items;
- append brief notes under each completed phase if needed;
- keep `docs/process-work-log.md` current;
- only finish after `Definition Of Done` is fully checked.

## Final Instruction To The Implementing Agent

Do not interpret this task as a request for partial refactoring.

Interpret it as:

"Complete the migration from visual beat enhancement to a template-driven, AI-planned, deterministic scene composition engine with block-level review and both overlay/full-scene rendering modes, and do not stop until all required phases, validations, and completion criteria in this document are satisfied."
