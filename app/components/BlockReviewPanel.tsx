"use client";

import { useState } from "react";
import type { ProjectPayload } from "@/app/components/projectFlowTypes";
import { SceneRecipePicker } from "@/app/components/SceneRecipePicker";
import type { SceneRecipeId } from "@/lib/types";

type BlockAction =
  | "regenerate_block"
  | "change_scene"
  | "simplify_scene"
  | "make_stronger"
  | "disable_layer"
  | "bring_speaker_back"
  | "hide_speaker_for_block"
  | "switch_to_safe_mode";

export function BlockReviewPanel({
  payload,
  busy,
  onApply
}: {
  payload: ProjectPayload;
  busy: boolean;
  onApply: (request: { blockId: string; action: BlockAction; recipeId?: SceneRecipeId; layerId?: string }) => Promise<void>;
}) {
  const scenePlan = payload.draft?.scenePlan;
  const compiledPlan = payload.draft?.compiledScenePlan;
  const [recipeDrafts, setRecipeDrafts] = useState<Record<string, SceneRecipeId>>({});

  if (!scenePlan || scenePlan.blocks.length === 0) return null;

  return (
    <section className="visual-review-panel">
      <header className="section-lead">
        <h3>Проверка сцен по блокам</h3>
        <p>Здесь меняются решения planner-а по блокам, а не таймлайн.</p>
      </header>
      <div className="visual-review-list">
        {scenePlan.blocks.map((block) => {
          const compiledBlock = compiledPlan?.blocks.find((item) => item.blockId === block.blockId);
          const selectedRecipe = recipeDrafts[block.blockId] ?? block.recipeId;
          return (
            <article className="visual-review-chip block-review-card" key={block.id}>
              <strong>{compiledBlock?.summary ?? block.blockType}</strong>
              <span>{formatTime(block.start)} - {formatTime(block.end)} · {block.sceneCategory}</span>
              <span>{selectedRecipe}</span>
              <span>{block.layerPlan.filter((layer) => layer.enabled).map((layer) => layer.kind).join(" · ") || "Без слоев"}</span>
              <SceneRecipePicker
                disabled={busy}
                recipeIds={block.allowedRecipeIds?.length ? block.allowedRecipeIds : [block.recipeId]}
                value={selectedRecipe}
                onChange={(recipeId) => setRecipeDrafts((current) => ({ ...current, [block.blockId]: recipeId }))}
              />
              <div className="review-button-grid">
                <button className="mode-button secondary-action" type="button" disabled={busy} onClick={() => onApply({ blockId: block.blockId, action: "regenerate_block" })}>Regenerate</button>
                <button className="mode-button secondary-action" type="button" disabled={busy} onClick={() => onApply({ blockId: block.blockId, action: "change_scene", recipeId: selectedRecipe })}>Change scene</button>
                <button className="mode-button secondary-action" type="button" disabled={busy} onClick={() => onApply({ blockId: block.blockId, action: "simplify_scene" })}>Simplify</button>
                <button className="mode-button secondary-action" type="button" disabled={busy} onClick={() => onApply({ blockId: block.blockId, action: "make_stronger" })}>Make stronger</button>
                <button className="mode-button secondary-action" type="button" disabled={busy} onClick={() => onApply({ blockId: block.blockId, action: "switch_to_safe_mode" })}>Safe mode</button>
                <button className="mode-button secondary-action" type="button" disabled={busy} onClick={() => onApply({ blockId: block.blockId, action: "bring_speaker_back" })}>Bring speaker back</button>
                <button className="mode-button secondary-action" type="button" disabled={busy} onClick={() => onApply({ blockId: block.blockId, action: "hide_speaker_for_block" })}>Hide speaker</button>
                {block.layerPlan.filter((layer) => layer.enabled).slice(0, 1).map((layer) => (
                  <button
                    className="mode-button secondary-action"
                    key={layer.id}
                    type="button"
                    disabled={busy}
                    onClick={() => onApply({ blockId: block.blockId, action: "disable_layer", layerId: layer.id })}
                  >
                    Disable {layer.kind}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatTime(value: number) {
  return value.toFixed(1) + "s";
}
