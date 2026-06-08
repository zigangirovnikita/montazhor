"use client";

import Link from "next/link";
import type { PointerEvent } from "react";
import {
  curatedPalettes,
  templateBlockLabels,
  templateTabs,
  blockLayoutPresets
} from "@/lib/templateBuilder";

import { useTemplateState } from "./hooks/useTemplateState";
import { useTemplatePersist } from "./hooks/useTemplatePersist";
import { usePreviewSync } from "./hooks/usePreviewSync";

import { Preview } from "./preview/Preview";
import { EditorSection } from "./controls/EditorSection";
import { PositionControls } from "./controls/PositionControls";
import { ColorControls } from "./controls/ColorControls";
import { TypographyControls } from "./controls/TypographyControls";
import { SurfaceControls } from "./controls/SurfaceControls";
import { MotionControls } from "./controls/MotionControls";
import { ChoiceGrid } from "./shared/ChoiceGrid";
import { ToggleRow } from "./shared/ToggleRow";
import { ConfirmDialog } from "./shared/ConfirmDialog";
import { TabRail } from "./rail/TabRail";
import { clamp, snapAnchor } from "./utils/mathUtils";

import styles from "../TemplateBuilder.module.css";

export function TemplateBuilder() {
  const state = useTemplateState();
  const {
    templates, setTemplates, current, setCurrent, draft, setDraft,
    activeTab, elementPreviewKind, setElementPreviewKind, snapshot,
    setSnapshot, status, setStatus, confirmState, openSection, setOpenSection,
    sectionSnapshot, setSectionSnapshot, animationTrigger, setAnimationTrigger,
    isDirty, effectiveBlock, optionsSummary, previewKind,
    requestConfirm, closeConfirm, confirmPendingAction,
    switchTab, updateName, updateTheme, updateBlock, setPosition,
    openEditorSection, cancelEditorSection
  } = state;

  const persist = useTemplatePersist({
    current, setCurrent, draft, setDraft, setTemplates, setSnapshot,
    setStatus, setOpenSection, setSectionSnapshot, isDirty
  });

  const { shellRef, previewColumnRef, stageRef } = usePreviewSync([
    current?.id, activeTab, templates.length, elementPreviewKind
  ]);

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    moveHandle(event);
  }

  function moveHandle(event: PointerEvent<HTMLButtonElement>) {
    if (!stageRef.current || activeTab === "theme") return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 4, 96);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 4, 96);
    setPosition({ x, y, anchor: snapAnchor(x, y) });
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.back} href="/">Назад</Link>
        <div>
          <p className={styles.kicker}>Template Builder</p>
          <h1>Шаблон для автопилота</h1>
          <p>Настрой визуальную систему один раз, сохрани ее на сервере и назначь дефолтной для новых роликов.</p>
        </div>
      </header>

      <section className={styles.shell} ref={shellRef}>
        <section className={styles.previewColumn} ref={previewColumnRef}>
          <div className={styles.previewTop}>
            <div>
              <p className={styles.kicker}>{current?.isDefault ? "Default template" : current?.isPreset ? "Built-in preset" : "Editable template"}</p>
              <input
                className={styles.titleInput}
                value={draft.name}
                onChange={(event) => updateName(event.target.value)}
                onBlur={() => persist.saveSection()}
              />
            </div>
            <span>{templateBlockLabels[activeTab].title}</span>
          </div>
          <Preview
            block={effectiveBlock}
            theme={draft.theme}
            kind={previewKind}
            dragEnabled={activeTab !== "theme"}
            stageRef={stageRef}
            onPointerDown={startDrag}
            onPointerMove={moveHandle}
            animationTrigger={animationTrigger}
            onReplay={() => setAnimationTrigger((prev) => prev + 1)}
          />
          <div className={styles.presetStrip}>
            {templates.map((item) => (
              <button
                className={item.id === current?.id ? styles.selectedPreset : ""}
                key={item.id}
                type="button"
                onClick={() => {
                  if (isDirty) {
                    requestConfirm({
                      title: "Есть несохраненные изменения",
                      message: "Переключить шаблон?",
                      confirmLabel: "Переключить"
                    }, () => {
                      setCurrent(item);
                      setDraft(item.data);
                      setSnapshot(JSON.stringify(item.data));
                      setAnimationTrigger((prev) => prev + 1);
                    });
                    return;
                  }
                  setCurrent(item);
                  setDraft(item.data);
                  setSnapshot(JSON.stringify(item.data));
                  setAnimationTrigger((prev) => prev + 1);
                }}
              >
                {item.name}{item.isDefault ? " · default" : ""}
              </button>
            ))}
          </div>
        </section>

        <div className={styles.contentGrid}>
          <TabRail draft={draft} activeTab={activeTab} switchTab={switchTab} />

          <aside className={styles.controls}>
            <div className={styles.nameField}>
              <span>Действия</span>
              <div className={styles.actionRow}>
                <button type="button" onClick={() => void persist.duplicateTemplate()}>{current?.isPreset ? "Создать из пресета" : "Дублировать"}</button>
                <button type="button" onClick={() => void persist.makeDefault()} disabled={current?.isDefault}>Сделать дефолтным</button>
              </div>
              <small style={{ display: "block", marginTop: "8px" }}>
                Новые проекты получат: {optionsSummary.presetPack ?? "balanced"}, движение {optionsSummary.motionIntensity ?? "medium"}.
              </small>
            </div>

            {isDirty && (
              <button type="button" className={styles.save} onClick={() => void persist.saveSection()}>
                {status === "saving" ? "Сохраняю..." : "Сохранить изменения"}
              </button>
            )}

            {activeTab === "theme" ? (
              <div className={styles.group}>
                <h3>Готовые цветовые палитры</h3>
                <div className={styles.choiceGrid} style={{ gridTemplateColumns: "1fr", gap: "8px" }}>
                  {curatedPalettes.map((palette, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={styles.segmented}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        width: "100%",
                        background: "rgba(255, 255, 255, 0.04)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "12px",
                        cursor: "pointer",
                        color: "#fff"
                      }}
                      onClick={() => {
                        updateTheme({
                          colorText: palette.colorText,
                          colorPrimary: palette.colorPrimary,
                          colorBackground: palette.colorBackground
                        });
                      }}
                    >
                      <span style={{ fontSize: "13px", fontWeight: "bold" }}>{palette.name}</span>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <span style={{ display: "inline-block", width: "16px", height: "16px", borderRadius: "50%", backgroundColor: palette.colorText, border: "1px solid rgba(255,255,255,0.2)" }} />
                        <span style={{ display: "inline-block", width: "16px", height: "16px", borderRadius: "50%", backgroundColor: palette.colorPrimary, border: "1px solid rgba(255,255,255,0.2)" }} />
                        <span style={{ display: "inline-block", width: "16px", height: "16px", borderRadius: "50%", backgroundColor: palette.colorBackground, border: "1px solid rgba(255,255,255,0.2)" }} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <ToggleRow block={effectiveBlock} onChange={(enabled) => updateBlock({ enabled })} />

                {activeTab === "elements" && (
                  <div className={styles.group}>
                    <h3>Настраиваемый элемент</h3>
                    <ChoiceGrid
                      items={[
                        { id: "list", label: "Список" },
                        { id: "chart", label: "График" },
                        { id: "comparison", label: "Сравнение" },
                        { id: "accent", label: "Акцент" },
                        { id: "cta", label: "CTA" }
                      ]}
                      value={elementPreviewKind}
                      onChange={(val) => setElementPreviewKind(val as "list" | "comparison" | "accent" | "chart" | "cta")}
                    />
                  </div>
                )}

                {blockLayoutPresets[activeTab === "elements" ? elementPreviewKind : activeTab] ? (
                  <div className={styles.group}>
                    <h3>Макет / Пресет раскладки</h3>
                    <ChoiceGrid
                      items={blockLayoutPresets[activeTab === "elements" ? elementPreviewKind : activeTab]}
                      value={String(effectiveBlock?.layoutPreset ?? "")}
                      onChange={(layoutPreset) => updateBlock({ layoutPreset })}
                    />
                  </div>
                ) : null}
              </>
            )}

            <EditorSection section="position" open={openSection === "position"} onOpen={() => openEditorSection("position")} onSave={persist.saveEditorSection} onCancel={cancelEditorSection} status={status}>
              <PositionControls position={effectiveBlock.position} onChange={setPosition} />
            </EditorSection>

            <EditorSection section="colors" open={openSection === "colors"} onOpen={() => openEditorSection("colors")} onSave={persist.saveEditorSection} onCancel={cancelEditorSection} status={status}>
              <ColorControls tab={activeTab} block={activeTab === "theme" ? null : effectiveBlock} template={draft} updateTheme={updateTheme} updateBlock={updateBlock} />
            </EditorSection>

            <EditorSection section="typography" open={openSection === "typography"} onOpen={() => openEditorSection("typography")} onSave={persist.saveEditorSection} onCancel={cancelEditorSection} status={status}>
              <TypographyControls tab={activeTab} block={activeTab === "theme" ? null : effectiveBlock} template={draft} updateTheme={updateTheme} updateBlock={updateBlock} />
            </EditorSection>

            <EditorSection section="surface" open={openSection === "surface"} onOpen={() => openEditorSection("surface")} onSave={persist.saveEditorSection} onCancel={cancelEditorSection} status={status}>
              <SurfaceControls tab={activeTab} block={activeTab === "theme" ? null : effectiveBlock} template={draft} updateTheme={updateTheme} updateBlock={updateBlock} />
            </EditorSection>

            <EditorSection section="motion" open={openSection === "motion"} onOpen={() => openEditorSection("motion")} onSave={persist.saveEditorSection} onCancel={cancelEditorSection} status={status}>
              <MotionControls tab={activeTab} block={activeTab === "theme" ? null : effectiveBlock} template={draft} updateTheme={updateTheme} updateBlock={updateBlock} />
            </EditorSection>
          </aside>
        </div>
      </section>

      <ConfirmDialog state={confirmState} onClose={closeConfirm} onConfirm={confirmPendingAction} />
    </main>
  );
}
