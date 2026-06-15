"use client";

import { useMemo, useState } from "react";
import type { ProjectPayload } from "@/app/components/projectFlowTypes";
import { SceneRecipePicker } from "@/app/components/SceneRecipePicker";
import type { SceneRecipeId, ScreenCopyPayload } from "@/lib/types";

type BlockAction =
  | "regenerate_block"
  | "change_scene"
  | "simplify_scene"
  | "make_stronger"
  | "disable_layer"
  | "bring_speaker_back"
  | "hide_speaker_for_block"
  | "switch_to_safe_mode"
  | "disable_insert"
  | "edit_copy";

export function BlockReviewPanel({
  payload,
  busy,
  onApply
}: {
  payload: ProjectPayload;
  busy: boolean;
  onApply: (request: { blockId: string; action: BlockAction; recipeId?: SceneRecipeId; layerId?: string; copyPatch?: Partial<ScreenCopyPayload> }) => Promise<void>;
}) {
  const directorPlan = payload.draft?.directorPlan;
  const screenCopyPlan = payload.draft?.screenCopyPlan;
  const compiledPlan = payload.draft?.compiledScenePlan;
  const [recipeDrafts, setRecipeDrafts] = useState<Record<string, SceneRecipeId>>({});
  const [copyDrafts, setCopyDrafts] = useState<Record<string, ScreenCopyPayload>>({});

  const semanticMap = useMemo(() => new Map((payload.draft?.semanticBlocks ?? []).map((block) => [block.id, block])), [payload.draft?.semanticBlocks]);
  const copyMap = useMemo(() => new Map((screenCopyPlan?.blocks ?? []).map((block) => [block.blockId, block])), [screenCopyPlan]);

  if (!directorPlan || directorPlan.blocks.length === 0) return null;

  return (
    <section className="visual-review-panel">
      <header className="section-lead">
        <h3>Проверка сцен по блокам</h3>
        <p>Подтверди режиссерское решение, экранный текст и при необходимости упрости или выключи отдельную вставку.</p>
      </header>
      <div className="visual-review-list">
        {directorPlan.blocks.map((block) => {
          const semanticBlock = semanticMap.get(block.blockId);
          const compiledBlock = compiledPlan?.blocks.find((item) => item.blockId === block.blockId);
          const copyBlock = copyMap.get(block.blockId);
          const selectedRecipe = recipeDrafts[block.blockId] ?? block.recipeId;
          const draftCopy = copyDrafts[block.blockId] ?? copyBlock?.payload ?? {};
          return (
            <article className="visual-review-chip block-review-card" key={block.id}>
              <strong>{semanticBlock?.summary ?? block.blockType}</strong>
              <span>{formatTime(block.start)} - {formatTime(block.end)} · {block.blockType}</span>
              <span>{selectedRecipe} · {block.scenePriority} · confidence {Math.round((copyBlock?.planningConfidence.score ?? block.planningConfidence.score) * 100)}%</span>
              <span>{semanticBlock?.text ?? "Нет transcript fragment"}</span>
              <span>{compiledBlock?.renderPath === "full_scene" ? "full scene" : "overlay"} · {block.speakerMode}</span>
              <SceneRecipePicker
                disabled={busy}
                recipeIds={block.allowedRecipeIds?.length ? block.allowedRecipeIds : [block.recipeId]}
                value={selectedRecipe}
                onChange={(recipeId) => setRecipeDrafts((current) => ({ ...current, [block.blockId]: recipeId }))}
              />
              <CopyEditor
                blockId={block.blockId}
                value={draftCopy}
                editableFields={copyBlock?.editableFields ?? []}
                disabled={busy}
                onChange={(next) => setCopyDrafts((current) => ({ ...current, [block.blockId]: next }))}
                onSave={() => onApply({ blockId: block.blockId, action: "edit_copy", copyPatch: draftCopy })}
              />
              <div className="review-button-grid">
                <button className="mode-button secondary-action" type="button" disabled={busy} onClick={() => onApply({ blockId: block.blockId, action: "regenerate_block" })}>Regenerate</button>
                <button className="mode-button secondary-action" type="button" disabled={busy} onClick={() => onApply({ blockId: block.blockId, action: "change_scene", recipeId: selectedRecipe })}>Swap recipe</button>
                <button className="mode-button secondary-action" type="button" disabled={busy} onClick={() => onApply({ blockId: block.blockId, action: "simplify_scene" })}>Simplify</button>
                <button className="mode-button secondary-action" type="button" disabled={busy} onClick={() => onApply({ blockId: block.blockId, action: "make_stronger" })}>Make stronger</button>
                <button className="mode-button secondary-action" type="button" disabled={busy} onClick={() => onApply({ blockId: block.blockId, action: "disable_insert" })}>Disable insert</button>
                <button className="mode-button secondary-action" type="button" disabled={busy} onClick={() => onApply({ blockId: block.blockId, action: "switch_to_safe_mode" })}>Safe mode</button>
                <button className="mode-button secondary-action" type="button" disabled={busy} onClick={() => onApply({ blockId: block.blockId, action: "bring_speaker_back" })}>Bring speaker back</button>
                <button className="mode-button secondary-action" type="button" disabled={busy} onClick={() => onApply({ blockId: block.blockId, action: "hide_speaker_for_block" })}>Hide speaker</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CopyEditor({
  blockId,
  value,
  editableFields,
  disabled,
  onChange,
  onSave
}: {
  blockId: string;
  value: ScreenCopyPayload;
  editableFields: Array<keyof ScreenCopyPayload>;
  disabled: boolean;
  onChange: (next: ScreenCopyPayload) => void;
  onSave: () => void;
}) {
  const visibleFields = editableFields.length > 0 ? editableFields : (Object.keys(value) as Array<keyof ScreenCopyPayload>);
  if (visibleFields.length === 0) return null;

  return (
    <div className="flow-stack">
      {visibleFields.slice(0, 4).map((field) => {
        const rawValue = value[field];
        const stringValue = Array.isArray(rawValue) ? rawValue.join("\n") : typeof rawValue === "string" ? rawValue : "";
        return (
          <label key={`${blockId}-${field}`}>
            <span>{field}</span>
            <textarea
              rows={field === "items" ? 4 : 2}
              disabled={disabled}
              value={stringValue}
              onChange={(event) => {
                const nextValue = field === "items"
                  ? event.target.value.split("\n").map((item) => item.trim()).filter(Boolean)
                  : event.target.value;
                onChange({ ...value, [field]: nextValue });
              }}
            />
          </label>
        );
      })}
      <button className="mode-button secondary-action" type="button" disabled={disabled} onClick={onSave}>Save copy</button>
    </div>
  );
}

function formatTime(value: number) {
  return value.toFixed(1) + "s";
}
