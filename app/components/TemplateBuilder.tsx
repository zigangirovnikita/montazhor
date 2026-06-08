"use client";

import Link from "next/link";
import type { CSSProperties, PointerEvent, ReactNode, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import {
  createDefaultTemplate,
  positionForAnchor,
  sanitizeTemplateData,
  templateAnimations,
  templateAnimationsOut,
  curatedPalettes,
  templateBlockLabels,
  templateFonts,
  templateShadows,
  templateSurfaces,
  templateTabs,
  templateToVisualPlanOptions,
  blockLayoutPresets,
  type StoredTemplate,
  type TemplateAnchor,
  type TemplateBlockBase,
  type TemplateEditorTab,
  type TemplatePosition,
  type VisualTemplateData
} from "@/lib/templateBuilder";
import { TemplateColorPicker } from "./TemplateColorPicker";
import styles from "./TemplateBuilder.module.css";

type SectionId = "position" | "colors" | "typography" | "surface" | "motion";
type Status = "idle" | "saving" | "saved" | "error";
type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
};

const sectionLabels: Record<SectionId, string> = {
  position: "Позиция",
  colors: "Цвета",
  typography: "Типографика",
  surface: "Подложка",
  motion: "Тени и движение"
};

export function TemplateBuilder() {
  const [templates, setTemplates] = useState<StoredTemplate[]>([]);
  const [current, setCurrent] = useState<StoredTemplate | null>(null);
  const [draft, setDraft] = useState<VisualTemplateData>(() => createDefaultTemplate());
  const [activeTab, setActiveTab] = useState<TemplateEditorTab>("theme");
  const [elementPreviewKind, setElementPreviewKind] = useState<"list" | "comparison" | "accent" | "chart" | "cta">("list");
  const [snapshot, setSnapshot] = useState<string>("");
  const [status, setStatus] = useState<Status>("idle");
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [openSection, setOpenSection] = useState<SectionId | null>(null);
  const [sectionSnapshot, setSectionSnapshot] = useState<string | null>(null);
  const confirmActionRef = useRef<null | (() => void)>(null);
  const shellRef = useRef<HTMLElement | null>(null);
  const previewColumnRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [animationTrigger, setAnimationTrigger] = useState(0);

  const activeBlock = activeTab === "theme"
    ? null
    : activeTab === "elements"
      ? draft.blocks[elementPreviewKind]
      : draft.blocks[activeTab];
  const effectiveBlock = activeBlock ?? themeAsBlock(draft);
  const isDirty = JSON.stringify(draft) !== snapshot;

  useEffect(() => {
    void loadTemplates();
  }, []);

  useEffect(() => {
    if (!shellRef.current || !previewColumnRef.current || typeof ResizeObserver === "undefined") return;

    const syncPreviewHeight = () => {
      if (!shellRef.current || !previewColumnRef.current) return;
      shellRef.current.style.setProperty("--mobile-preview-height", `${Math.ceil(previewColumnRef.current.getBoundingClientRect().height)}px`);
    };

    syncPreviewHeight();

    const observer = new ResizeObserver(() => syncPreviewHeight());
    observer.observe(previewColumnRef.current);

    window.addEventListener("resize", syncPreviewHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncPreviewHeight);
    };
  }, [current?.id, activeTab, templates.length, draft.name]);

  async function loadTemplates() {
    const response = await fetch("/api/templates", { cache: "no-store" });
    const payload = await response.json();
    const list = Array.isArray(payload.templates) ? payload.templates as StoredTemplate[] : [];
    setTemplates(list);
    const selected = list.find((item) => item.isDefault && !item.isPreset) ?? list.find((item) => !item.isPreset) ?? list[0];
    if (selected) {
      setCurrent(selected);
      setDraft(sanitizeTemplateData(selected.data, selected.name));
    }
  }

  function switchTab(tab: TemplateEditorTab) {
    if (isDirty) {
      requestConfirm({
        title: "Есть несохраненные изменения",
        message: "Перейти без сохранения?",
        confirmLabel: "Перейти"
      }, () => {
        setActiveTab(tab);
        setSnapshot(JSON.stringify(draft));
        setAnimationTrigger((prev) => prev + 1);
      });
      return;
    }
    setActiveTab(tab);
    setSnapshot(JSON.stringify(draft));
    setAnimationTrigger((prev) => prev + 1);
  }

  function requestConfirm(state: ConfirmState, onConfirm: () => void) {
    confirmActionRef.current = onConfirm;
    setConfirmState(state);
  }

  function closeConfirm() {
    confirmActionRef.current = null;
    setConfirmState(null);
  }

  function confirmPendingAction() {
    const action = confirmActionRef.current;
    closeConfirm();
    action?.();
  }

  function cancelSection() {
    if (snapshot) setDraft(JSON.parse(snapshot) as VisualTemplateData);
    setStatus("idle");
  }

  async function saveSection() {
    setStatus("saving");
    try {
      const saved = await persistTemplate(draft);
      setCurrent(saved);
      setTemplates((items) => upsertTemplate(items, saved));
      setDraft(sanitizeTemplateData(saved.data, saved.name));
      setSnapshot(JSON.stringify(saved.data));
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  async function duplicateTemplate(template = current) {
    if (!template) return;
    setStatus("saving");
    const response = await fetch(`/api/templates/${template.id}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${template.name} copy` })
    });
    if (!response.ok) {
      setStatus("error");
      return;
    }
    const payload = await response.json();
    const next = payload.template as StoredTemplate;
    setCurrent(next);
    setDraft(sanitizeTemplateData(next.data, next.name));
    setSnapshot(JSON.stringify(next.data));
    setTemplates((items) => upsertTemplate(items, next));
    setStatus("saved");
  }

  async function makeDefault() {
    setStatus("saving");
    let target = current;
    if (!target) return;
    if (target.isPreset) {
      const duplicateResponse = await fetch(`/api/templates/${target.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${target.name} default`, makeDefault: true })
      });
      if (!duplicateResponse.ok) {
        setStatus("error");
        return;
      }
      target = (await duplicateResponse.json()).template as StoredTemplate;
    } else {
      target = await persistTemplate(draft);
      const response = await fetch(`/api/templates/${target.id}/default`, { method: "POST" });
      if (!response.ok) {
        setStatus("error");
        return;
      }
      target = (await response.json()).template as StoredTemplate;
    }
    setCurrent(target);
    setDraft(sanitizeTemplateData(target.data, target.name));
    setSnapshot(JSON.stringify(target.data));
    setTemplates((items) => upsertTemplate(items.map((item) => ({ ...item, isDefault: false })), target));
    setStatus("saved");
  }

  async function persistTemplate(data: VisualTemplateData) {
    const body = JSON.stringify({ name: data.name, data: sanitizeTemplateData(data, data.name) });
    const response = current && !current.isPreset
      ? await fetch(`/api/templates/${current.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body })
      : await fetch("/api/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    if (!response.ok) throw new Error("Template save failed");
    return (await response.json()).template as StoredTemplate;
  }

  function updateName(name: string) {
    setDraft((item) => ({ ...item, name }));
  }

  function updateTheme(patch: Partial<VisualTemplateData["theme"]>) {
    setDraft((item) => ({ ...item, theme: { ...item.theme, ...patch } }));
    setAnimationTrigger((prev) => prev + 1);
  }

  function updateBlock(patch: Partial<TemplateBlockBase> & Record<string, unknown>) {
    if (activeTab === "theme") return;
    setDraft((item) => {
      const nextBlocks = { ...item.blocks };
      if (activeTab === "elements") {
        if ("layoutPreset" in patch) {
          nextBlocks[elementPreviewKind] = { ...nextBlocks[elementPreviewKind], layoutPreset: patch.layoutPreset };
        } else {
          const elementKeys: Array<keyof typeof item.blocks> = ["list", "comparison", "accent", "chart", "cta"];
          for (const key of elementKeys) {
            nextBlocks[key] = { ...nextBlocks[key], ...patch };
          }
        }
      } else {
        nextBlocks[activeTab] = { ...nextBlocks[activeTab], ...patch };
      }
      return { ...item, blocks: nextBlocks };
    });
    setAnimationTrigger((prev) => prev + 1);
  }

  function setPosition(position: TemplatePosition) {
    if (activeTab === "theme") updateTheme({ defaultPosition: position });
    else updateBlock({ position });
    setAnimationTrigger((prev) => prev + 1);
  }

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

  const optionsSummary = useMemo(() => templateToVisualPlanOptions(draft), [draft]);

  const previewKind = useMemo(() => {
    if (activeTab === "theme") return "surface";
    if (activeTab === "headline") return "title";
    if (activeTab === "subtitle") return "text";
    if (activeTab === "stat") return "number";
    if (activeTab === "elements") {
      if (elementPreviewKind === "list") return "list";
      if (elementPreviewKind === "comparison" || elementPreviewKind === "accent") return "accent";
      if (elementPreviewKind === "chart") return "chart";
      if (elementPreviewKind === "cta") return "cta";
    }
    return "text";
  }, [activeTab, elementPreviewKind]);

  function openEditorSection(section: SectionId) {
    if (isDirty && sectionSnapshot && JSON.stringify(draft) !== sectionSnapshot) {
      requestConfirm({
        title: "Есть несохраненные изменения",
        message: "Переключить раздел? Несохраненные изменения в этом разделе будут потеряны.",
        confirmLabel: "Переключить"
      }, () => {
        setDraft(JSON.parse(sectionSnapshot));
        setOpenSection(section);
        setSectionSnapshot(JSON.stringify(JSON.parse(sectionSnapshot))); 
      });
      return;
    }
    setOpenSection(section === openSection ? null : section);
    if (section !== openSection) {
      setSectionSnapshot(JSON.stringify(draft));
    } else {
      setSectionSnapshot(null);
    }
  }

  function saveEditorSection() {
    saveSection();
    setOpenSection(null);
    setSectionSnapshot(null);
  }

  function cancelEditorSection() {
    if (sectionSnapshot) {
      setDraft(JSON.parse(sectionSnapshot));
    }
    setOpenSection(null);
    setSectionSnapshot(null);
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
              <input className={styles.titleInput} value={draft.name} onChange={(event) => updateName(event.target.value)} onBlur={() => void saveSection()} />
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
              <button className={item.id === current?.id ? styles.selectedPreset : ""} key={item.id} type="button" onClick={() => {
                if (isDirty) {
                  requestConfirm({
                    title: "Есть несохраненные изменения",
                    message: "Переключить шаблон?",
                    confirmLabel: "Переключить"
                  }, () => {
                    setCurrent(item);
                    setDraft(sanitizeTemplateData(item.data, item.name));
                    setSnapshot(JSON.stringify(item.data));
                    setAnimationTrigger((prev) => prev + 1);
                  });
                  return;
                }
                setCurrent(item);
                setDraft(sanitizeTemplateData(item.data, item.name));
                setSnapshot(JSON.stringify(item.data));
                setAnimationTrigger((prev) => prev + 1);
              }}>
                {item.name}{item.isDefault ? " · default" : ""}
              </button>
            ))}
          </div>
        </section>

        <div className={styles.contentGrid}>
          <aside className={styles.rail} aria-label="Разделы шаблона">
            {templateTabs.map((tab) => {
              const isEnabled = tab === "theme"
                ? true
                : tab === "elements"
                  ? (draft.blocks.list.enabled || draft.blocks.comparison.enabled || draft.blocks.accent.enabled || draft.blocks.chart.enabled || draft.blocks.cta.enabled)
                  : draft.blocks[tab].enabled;
              return (
                <button className={`${styles.category} ${tab === activeTab ? styles.active : ""}`} key={tab} type="button" onClick={() => switchTab(tab)}>
                  <strong><i className={isEnabled === false ? styles.dotOff : styles.dotOn} />{templateBlockLabels[tab].title}</strong>
                  <span>{templateBlockLabels[tab].note}</span>
                </button>
              );
            })}
          </aside>

          <aside className={styles.controls}>
            <div className={styles.nameField}>
              <span>Действия</span>
              <div className={styles.actionRow}>
                <button type="button" onClick={() => void duplicateTemplate()}>{current?.isPreset ? "Создать из пресета" : "Дублировать"}</button>
                <button type="button" onClick={() => void makeDefault()} disabled={current?.isDefault}>Сделать дефолтным</button>
              </div>
              <small style={{ display: "block", marginTop: "8px" }}>
                Новые проекты получат: {optionsSummary.presetPack ?? "balanced"}, движение {optionsSummary.motionIntensity ?? "medium"}.
              </small>
            </div>

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
                      onChange={(val) => setElementPreviewKind(val as any)}
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

            <EditorSection section="position" open={openSection === "position"} onOpen={() => openEditorSection("position")} onSave={saveEditorSection} onCancel={cancelEditorSection} status={status}>
              <PositionControls position={effectiveBlock.position} onChange={setPosition} />
            </EditorSection>

            <EditorSection section="colors" open={openSection === "colors"} onOpen={() => openEditorSection("colors")} onSave={saveEditorSection} onCancel={cancelEditorSection} status={status}>
              <ColorControls tab={activeTab} block={activeTab === "theme" ? null : effectiveBlock} template={draft} updateTheme={updateTheme} updateBlock={updateBlock} />
            </EditorSection>

            <EditorSection section="typography" open={openSection === "typography"} onOpen={() => openEditorSection("typography")} onSave={saveEditorSection} onCancel={cancelEditorSection} status={status}>
              <TypographyControls tab={activeTab} block={activeTab === "theme" ? null : effectiveBlock} template={draft} updateTheme={updateTheme} updateBlock={updateBlock} />
            </EditorSection>

            <EditorSection section="surface" open={openSection === "surface"} onOpen={() => openEditorSection("surface")} onSave={saveEditorSection} onCancel={cancelEditorSection} status={status}>
              <SurfaceControls tab={activeTab} block={activeTab === "theme" ? null : effectiveBlock} template={draft} updateTheme={updateTheme} updateBlock={updateBlock} />
            </EditorSection>

            <EditorSection section="motion" open={openSection === "motion"} onOpen={() => openEditorSection("motion")} onSave={saveEditorSection} onCancel={cancelEditorSection} status={status}>
              <MotionControls tab={activeTab} block={activeTab === "theme" ? null : effectiveBlock} template={draft} updateTheme={updateTheme} updateBlock={updateBlock} />
            </EditorSection>
          </aside>
        </div>
      </section>
      {confirmState ? (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true" aria-labelledby="template-confirm-title" aria-describedby="template-confirm-message">
          <div className={styles.confirmCard}>
            <p className={styles.confirmKicker}>Подтверждение</p>
            <h2 id="template-confirm-title">{confirmState.title}</h2>
            <p id="template-confirm-message">{confirmState.message}</p>
            <div className={styles.confirmActions}>
              <button type="button" onClick={closeConfirm}>Отмена</button>
              <button type="button" onClick={confirmPendingAction}>{confirmState.confirmLabel}</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function scramble(word: string, seed: number) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const len = Math.max(3, word.length);
  for (let i = 0; i < len; i++) {
    const idx = (word.charCodeAt(i % word.length) * 17 + seed * 31 + i * 7) % chars.length;
    result += chars[idx];
  }
  return result;
}

function splitTextToSpans(text: string, emphasis?: string, preset?: string, accentColor?: string, textColor?: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const normalizedEmphasis = emphasis ? emphasis.toLowerCase().replace(/[^\p{L}\p{N}%$₽-]+/gu, "") : "";
  return words.map((word, index) => {
    const normalizedWord = word.toLowerCase().replace(/[^\p{L}\p{N}%$₽-]+/gu, "");
    const isEmphasis = normalizedEmphasis && normalizedWord === normalizedEmphasis;
    
    let style: CSSProperties = { display: "inline-block", marginRight: "6px" };
    if (textColor) style.color = textColor;
    
    // Set default styles/fonts per preset
    if (preset === "caption_neon_glow") {
      style.color = "rgba(0, 255, 240, 0.14)";
      style.fontFamily = "'Outfit', sans-serif";
      style.textTransform = "uppercase";
    } else if (preset === "caption_gradient_fill") {
      // Siri-like wipe: initial state is white/inactive (e.g. rgba(255,255,255,0.4))
      style.background = `linear-gradient(90deg, ${accentColor || "#fe9f1b"} 0%, #ffe54d 25%, ${accentColor || "#fe9f1b"} 50%, rgba(255, 255, 255, 0.4) 50.5%, rgba(255, 255, 255, 0.4) 100%)`;
      style.backgroundSize = "350% 100%";
      style.backgroundPosition = "100% 0";
      style.WebkitBackgroundClip = "text";
      style.color = "transparent";
      style.fontFamily = "'Montserrat', sans-serif";
      style.fontWeight = 900;
    } else if (preset === "caption_matrix_decode") {
      style.color = "#00ff41";
      style.fontFamily = "'Space Grotesk', sans-serif";
      style.position = "relative";
    } else if (preset === "kinetic_phrase_slam" || preset === "caption_kinetic_slam") {
      style.color = "rgba(255, 255, 255, 0.4)";
      style.fontFamily = "'Anton', sans-serif";
      style.textTransform = "uppercase";
    } else if (preset === "caption_clip_wipe") {
      style.clipPath = "inset(0 100% 0 0)";
      style.fontFamily = "'Poppins', sans-serif";
      style.textTransform = "uppercase";
      style.fontWeight = 800;
      style.color = "#ffffff";
    } else if (preset === "caption_highlight") {
      style.fontFamily = "'Montserrat', sans-serif";
      style.fontWeight = 800;
      style.textTransform = "uppercase";
      style.position = "relative";
      style.padding = "4px 8px 6px";
    } else if (preset === "caption_glitch_rgb") {
      style.fontFamily = "'Space Grotesk', sans-serif";
      style.fontWeight = 700;
      style.textTransform = "uppercase";
      style.color = "#ffffff";
    } else if (preset === "caption_emoji_pop") {
      style.fontFamily = "'Gabarito', sans-serif";
      style.fontWeight = 900;
      style.textTransform = "uppercase";
      style.color = "#ffffff";
      style.WebkitTextStroke = "2px #000000";
    } else if (preset === "caption_particle_burst") {
      style.fontFamily = "'Outfit', sans-serif";
      style.fontWeight = 900;
      style.textTransform = "uppercase";
      style.color = "rgba(255, 255, 255, 0.45)";
    } else if (preset === "caption_editorial_emphasis") {
      if (isEmphasis) {
        style.fontFamily = "'Playfair Display', serif";
        style.fontStyle = "italic";
        style.fontWeight = 800;
        style.fontSize = "1.8em";
        style.lineHeight = 0.9;
      } else {
        style.fontFamily = "'Inter', sans-serif";
        style.fontWeight = 400;
      }
    } else if (preset === "caption_pill_karaoke") {
      style.fontFamily = "'Poppins', sans-serif";
      style.fontWeight = 700;
      style.color = "#A6A6A6";
    } else if (preset === "caption_weight_shift") {
      style.fontFamily = "'Montserrat', sans-serif";
      style.fontWeight = 300;
    } else {
      style.color = "rgba(255, 255, 255, 0.35)";
    }

    const displayText = (preset === "caption_pill_karaoke" || preset === "caption_weight_shift")
      ? word.toLowerCase()
      : (preset === "caption_clip_wipe" || preset === "caption_highlight" || preset === "caption_glitch_rgb" || preset === "caption_emoji_pop" || preset === "caption_particle_burst")
        ? word.toUpperCase()
        : word;

    if (preset === "caption_matrix_decode") {
      const scr0 = scramble(word, 0);
      const scr1 = scramble(word, 1);
      return (
        <span
          key={index}
          className={`phrase-word ${isEmphasis ? "is-emphasis" : ""}`}
          data-offset={index * 0.15}
          data-duration={0.3}
          style={style}
        >
          <span className="matrix-real" style={{ visibility: "hidden" }}>{word}</span>
          <span className="matrix-scr0" style={{ display: "none", position: "absolute", left: 0 }}>{scr0}</span>
          <span className="matrix-scr1" style={{ display: "none", position: "absolute", left: 0 }}>{scr1}</span>
        </span>
      );
    }

    if (preset === "caption_highlight") {
      return (
        <span
          key={index}
          className={`phrase-word hl-word ${isEmphasis ? "is-emphasis" : ""}`}
          data-offset={index * 0.15}
          data-duration={0.3}
          style={style}
        >
          <span className="hl-word-bg" style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, #ff1745 0%, #df1238 100%)",
            borderRadius: "8px",
            opacity: 0,
            transform: "scaleX(0)",
            transformOrigin: "0% 50%",
            zIndex: -1
          }}></span>
          <span className="hl-word-text" style={{ position: "relative", zIndex: 1 }}>{displayText}</span>
        </span>
      );
    }

    return (
      <span
        key={index}
        className={`phrase-word ${isEmphasis ? "is-emphasis" : ""}`}
        data-offset={index * 0.15}
        data-duration={0.3}
        style={style}
      >
        {displayText}
      </span>
    );
  });
}

function applyOpacity(color: string | undefined | null, alpha: number): string {
  if (!color) return "";
  if (color.startsWith("#")) {
    const cleanHex = color.replace("#", "");
    let r = 0, g = 0, b = 0;
    if (cleanHex.length === 3) {
      r = parseInt(cleanHex[0] + cleanHex[0], 16);
      g = parseInt(cleanHex[1] + cleanHex[1], 16);
      b = parseInt(cleanHex[2] + cleanHex[2], 16);
    } else if (cleanHex.length === 6 || cleanHex.length === 8) {
      r = parseInt(cleanHex.substring(0, 2), 16);
      g = parseInt(cleanHex.substring(2, 4), 16);
      b = parseInt(cleanHex.substring(4, 6), 16);
    } else {
      return color;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } else if (color.startsWith("rgba")) {
    return color.replace(/[\d.]+\)$/g, `${alpha})`);
  } else if (color.startsWith("rgb")) {
    return color.replace("rgb", "rgba").replace(")", `, ${alpha})`);
  }
  return color;
}

function Preview({ block, theme, kind, dragEnabled, stageRef, onPointerDown, onPointerMove, animationTrigger, onReplay }: {
  block: TemplateBlockBase & Record<string, unknown>;
  theme: VisualTemplateData["theme"];
  kind: "title" | "text" | "number" | "chart" | "list" | "accent" | "surface" | "cta";
  dragEnabled: boolean;
  stageRef: RefObject<HTMLDivElement | null>;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  animationTrigger: number;
  onReplay: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const fontSize = numberValue(block.fontSize, numberValue((block.number as Record<string, unknown>)?.fontSize, numberValue((block.headline as Record<string, unknown>)?.fontSize, 58)));
  const weight = numberValue(block.fontWeight, numberValue((block.number as Record<string, unknown>)?.fontWeight, numberValue((block.headline as Record<string, unknown>)?.fontWeight, 900)));
  const position = block.position;

  const bgOpacity = block.surfaceOpacity !== undefined && block.surfaceOpacity !== null
    ? block.surfaceOpacity
    : (block.surface === "glass" ? 0.28 : 0.82);
  const rawBgColor = block.colorBackground ?? theme.colorBackground;
  const backgroundColor = block.surface === "none"
    ? "transparent"
    : applyOpacity(rawBgColor, bgOpacity);

  const overlayStyle = {
    left: `${position.x}%`,
    top: `${position.y}%`,
    color: block.colorText ?? theme.colorText,
    backgroundColor,
    borderColor: block.borderColor ?? block.colorAccent ?? theme.colorPrimary,
    borderRadius: block.borderRadius,
    padding: block.padding,
    "--overlay-scale": 0.58,
    "--anchor-x": position.anchor === "right" ? "-100%" : position.anchor === "center" || position.anchor === "bottom" ? "-50%" : "0%",
    "--anchor-y": position.anchor === "bottom" || position.anchor === "center" ? "-50%" : "0%",
    "--color-accent": block.colorAccent ?? theme.colorPrimary,
    "--accent": block.colorAccent ?? theme.colorPrimary
  } as CSSProperties;

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.killTweensOf(el);
      const targets = el.querySelectorAll(".phrase-word, .keyword, .number-value, .bullet-card, .check-item, .bar, .keyword-line, .truth-word, .myth-word, .stat-row, .concept-center, .concept-node, .lesson-title, .lesson-subtext");
      gsap.killTweensOf(targets);

      gsap.set(el, { opacity: 0, y: 0, x: 0, scale: 0.58 });
      gsap.set(targets, { opacity: 0, y: 0, x: 0, scale: 1, rotate: 0, scaleY: 1, "--strike-scale": 0, "--shine-x": "-130%" });

      const tl = gsap.timeline();
      const animSpeed = block.animationSpeed ?? theme.defaultAnimationSpeed ?? 0.6;
      const durationFactor = Math.max(0.24, 1.3 - animSpeed * 0.95);
      const animationIn = block.animationIn ?? "glass_slide";

      let enterFrom = { opacity: 0, y: 28, scale: 0.56 };
      let enterTo = { opacity: 1, y: 0, scale: 0.58, ease: "power3.out" };
      let enterDuration = 0.38 * durationFactor;

      if (animationIn === "depth_zoom") {
        enterFrom = { opacity: 0, scale: 0.55, y: 14 } as any;
        enterTo = { opacity: 1, scale: 0.58, y: 0, ease: "expo.out" } as any;
      } else if (animationIn === "calm_fade") {
        enterFrom = { opacity: 0, y: 14, scale: 0.58 } as any;
        enterTo = { opacity: 1, y: 0, scale: 0.58, ease: "power2.out" } as any;
      } else if (animationIn === "word_slam") {
        enterFrom = { opacity: 0, scale: 0.62, y: 0 } as any;
        enterTo = { opacity: 1, scale: 0.58, y: 0, ease: "back.out(1.35)" } as any;
      } else if (animationIn === "soft_pop") {
        enterFrom = { opacity: 0, scale: 0.44, y: 0 } as any;
        enterTo = { opacity: 1, scale: 0.58, y: 0, ease: "back.out(1.2)" } as any;
      } else if (animationIn === "slide-right") {
        enterFrom = { opacity: 0, x: -48, scale: 0.58 } as any;
        enterTo = { opacity: 1, x: 0, scale: 0.58, ease: "power2.out" } as any;
      } else if (animationIn === "fade") {
        enterFrom = { opacity: 0, scale: 0.58 } as any;
        enterTo = { opacity: 1, scale: 0.58, ease: "power1.out" } as any;
      } else if (animationIn === "scale") {
        enterFrom = { opacity: 0, scale: 0.22, y: 0 } as any;
        enterTo = { opacity: 1, scale: 0.58, y: 0, ease: "power2.out" } as any;
      } else if (animationIn === "glass_slide" || animationIn === "slide-up") {
        enterFrom = { opacity: 0, y: 28, scale: 0.58 } as any;
        enterTo = { opacity: 1, y: 0, scale: 0.58, ease: "power3.out" } as any;
      } else if (animationIn === "word-by-word") {
        enterFrom = { opacity: 0, scale: 0.58 } as any;
        enterTo = { opacity: 1, scale: 0.58, ease: "power1.out" } as any;
      } else if (animationIn === "none") {
        enterFrom = { opacity: 0, scale: 0.58 } as any;
        enterTo = { opacity: 1, scale: 0.58, ease: "none" } as any;
        enterDuration = 0.01;
      }

      tl.fromTo(el, enterFrom, {
        ...enterTo,
        duration: enterDuration
      });

      const preset = block.layoutPreset ?? "";

      if (kind === "text" || kind === "surface" || kind === "title") {
        if (preset === "lesson_title_block" || preset === "lesson_title_cinematic") {
          const lTitle = el.querySelector(".lesson-title");
          const lSub = el.querySelector(".lesson-subtext");
          if (lTitle) {
            tl.fromTo(lTitle, { opacity: 0, y: 28, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.38 * durationFactor, ease: "expo.out" }, "-=0.1");
          }
          if (lSub) {
            tl.fromTo(lSub, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.28 * durationFactor, ease: "power2.out" }, "-=0.2");
          }
        } else {
          const words = el.querySelectorAll(".phrase-word");
          if (words.length) {
            if (preset === "caption_matrix_decode") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const realEl = word.querySelector(".matrix-real");
                const scr0El = word.querySelector(".matrix-scr0");
                const scr1El = word.querySelector(".matrix-scr1");
                if (realEl && scr0El && scr1El) {
                  tl.set(scr0El, { display: "inline" }, offset);
                  tl.set(scr1El, { display: "inline" }, offset + 0.08 * durationFactor);
                  tl.set(scr0El, { display: "none" }, offset + 0.08 * durationFactor);
                  tl.set(realEl, { visibility: "visible" }, offset + 0.16 * durationFactor);
                  tl.set(scr1El, { display: "none" }, offset + 0.16 * durationFactor);
                }
              });
            } else if (preset === "caption_neon_glow") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                const activeColor = word.classList.contains("is-emphasis") ? "var(--color-accent)" : "#00FFF0";
                
                tl.to(word, {
                  color: activeColor,
                  textShadow: `0 0 10px ${activeColor}, 0 0 20px ${activeColor}`,
                  duration: 0.08 * durationFactor
                }, offset);
                
                tl.to(word, {
                  color: "rgba(0, 255, 240, 0.14)",
                  textShadow: "none",
                  duration: 0.08 * durationFactor
                }, offset + dur);
              });
            } else if (preset === "caption_gradient_fill") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                
                tl.set(word, { scale: 1.04 }, offset);
                tl.fromTo(word,
                  { backgroundPosition: "45% 0" },
                  { backgroundPosition: "0% 0", duration: dur, ease: "none" },
                  offset
                );
                tl.set(word, { backgroundPosition: "100% 0" }, offset + dur);
                tl.to(word, { scale: 1, duration: 0.15 * durationFactor, ease: "power2.out" }, offset + dur);
              });
            } else if (preset === "kinetic_phrase_slam" || preset === "caption_kinetic_slam") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                const activeColor = word.classList.contains("is-emphasis") ? "var(--color-accent)" : "#ffffff";
                
                tl.to(word, {
                  color: activeColor,
                  scale: 1.15,
                  duration: 0.1 * durationFactor,
                  ease: "back.out(2.2)"
                }, offset);
                
                tl.to(word, {
                  color: "rgba(255, 255, 255, 0.4)",
                  scale: 1,
                  duration: 0.12 * durationFactor,
                  ease: "power2.out"
                }, offset + dur);
              });
            } else if (preset === "caption_clip_wipe") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                const activeColor = word.classList.contains("is-emphasis") ? "var(--color-accent)" : "#ffffff";
                
                tl.to(word, { clipPath: "inset(0 0% 0 0)", duration: 0.3 * durationFactor, ease: "power2.out" }, offset);
                if (word.classList.contains("is-emphasis")) {
                  tl.to(word, { color: activeColor, duration: 0.05 }, offset + 0.1 * durationFactor);
                }
                tl.to(word, { color: "rgba(255, 255, 255, 0.4)", duration: 0.2 * durationFactor }, offset + dur);
              });
              tl.to(words, { clipPath: "inset(0 0% 0 100%)", duration: 0.25 * durationFactor, stagger: 0.04 * durationFactor, ease: "power2.in" }, "+=1.2");
            } else if (preset === "caption_highlight") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                const bgEl = word.querySelector(".hl-word-bg");
                
                if (bgEl) {
                  tl.to(bgEl, { opacity: 1, scaleX: 1, duration: 0.15 * durationFactor, ease: "power2.out" }, offset);
                  tl.to(word, { filter: "brightness(1.05)", duration: 0.08 * durationFactor, ease: "power2.out" }, offset);
                  tl.to(word, { filter: "brightness(1)", duration: 0.16 * durationFactor, ease: "power2.out" }, offset + 0.08 * durationFactor);
                  tl.to(bgEl, { opacity: 0, scaleX: 1.02, duration: 0.1 * durationFactor, ease: "power2.in" }, offset + dur);
                  tl.set(bgEl, { scaleX: 0 }, offset + dur + 0.1);
                }
              });
            } else if (preset === "caption_glitch_rgb") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                const travel = index % 2 === 0 ? -12 : 12;
                const sm = 8;
                
                tl.to(word, {
                  x: travel,
                  textShadow: `${sm}px 0 #ff003c, -${sm}px 0 #00e5ff, 0 5px 18px rgba(0,0,0,0.52)`,
                  duration: 0.1 * durationFactor,
                  ease: "none"
                }, offset);
                tl.to(word, {
                  x: 0,
                  textShadow: "0 5px 18px rgba(0,0,0,0.52)",
                  duration: 0.2 * durationFactor,
                  ease: "power3.out"
                }, offset + 0.1 * durationFactor);
                tl.to(word, { color: "rgba(255, 255, 255, 0.4)", duration: 0.1 }, offset + dur);
              });
            } else if (preset === "caption_emoji_pop") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                const activeColor = word.classList.contains("is-emphasis") ? "var(--color-accent)" : "#B2F7FF";
                
                tl.fromTo(word, 
                  { scaleX: 0.8, scaleY: 1, opacity: 0 },
                  { scaleX: 1, scaleY: 1, opacity: 1, color: activeColor, duration: 0.15 * durationFactor, ease: "power3.out" },
                  offset
                );
                tl.to(word, {
                  scaleX: 0.75, opacity: 0.8, duration: 0.1 * durationFactor, ease: "power2.in"
                }, offset + dur);
              });
            } else if (preset === "caption_particle_burst") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                const activeColor = word.classList.contains("is-emphasis") ? "#FFD700" : "#ffffff";
                
                tl.to(word, { color: activeColor, scale: 1.12, duration: 0.08 * durationFactor }, offset);
                tl.to(word, { color: "rgba(255, 255, 255, 0.45)", scale: 1, duration: 0.12 * durationFactor }, offset + dur);
              });
            } else if (preset === "caption_editorial_emphasis") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                
                tl.fromTo(word,
                  { opacity: 0, scale: 1.12, transformOrigin: "0% 100%" },
                  { opacity: 1, scale: 1, duration: 0.12 * durationFactor, ease: "power2.out" },
                  offset
                );
                tl.to(word, { color: "rgba(245, 240, 208, 0.5)", duration: 0.15 * durationFactor }, offset + dur);
              });
            } else if (preset === "caption_pill_karaoke") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                
                tl.to(word, { color: "#1C1E1D", duration: 0.1 * durationFactor, ease: "none" }, offset);
                tl.to(word, { color: "#A6A6A6", duration: 0.1 * durationFactor, ease: "none" }, offset + dur);
              });
            } else if (preset === "caption_weight_shift") {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.15 * durationFactor;
                const dur = 0.3 * durationFactor;
                
                tl.to(word, { fontWeight: 700, duration: 0.1 * durationFactor, ease: "power2.out" }, offset);
                tl.to(word, { fontWeight: 300, duration: 0.15 * durationFactor, ease: "power2.out" }, offset + dur);
              });
            } else {
              words.forEach((word, index) => {
                const offset = enterDuration * 0.6 + index * 0.12 * durationFactor;
                const dur = 0.3 * durationFactor;
                const activeColor = word.classList.contains("is-emphasis") ? "var(--color-accent)" : "#ffffff";
                
                tl.to(word, {
                  opacity: 1,
                  y: 0,
                  color: activeColor,
                  duration: 0.18 * durationFactor,
                  ease: "power2.out"
                }, offset);
                
                tl.to(word, {
                  color: "rgba(255, 255, 255, 0.55)",
                  duration: 0.12 * durationFactor,
                  ease: "power1.out"
                }, offset + dur);
              });
            }
          }
        }
      } else if (kind === "number") {
        if (preset === "hud_ratio_panel") {
          const rows = el.querySelectorAll(".stat-row");
          if (rows.length) {
            tl.fromTo(rows,
              { opacity: 0, x: -28 },
              { opacity: 1, x: 0, duration: 0.28 * durationFactor, stagger: 0.08 * durationFactor, ease: "power3.out" },
              "-=0.1"
            );
          }
        } else {
          const numValue = el.querySelector(".number-value");
          if (numValue) {
            tl.fromTo(numValue,
              { scale: 0.72, rotate: -2, opacity: 0 },
              { scale: 1, rotate: 0, opacity: 1, duration: 0.38 * durationFactor, ease: "back.out(1.35)" },
              "-=0.1"
            );
            tl.fromTo(numValue,
              { "--shine-x": "-130%" },
              { "--shine-x": "130%", duration: 0.6 * durationFactor, ease: "power2.inOut" },
              "-=0.08"
            );
          }
        }
      } else if (kind === "chart") {
        const bars = el.querySelectorAll(".bar");
        if (bars.length) {
          tl.fromTo(bars,
            { scaleY: 0.12, opacity: 0 },
            { scaleY: 1, opacity: 1, duration: 0.44 * durationFactor, stagger: 0.08 * durationFactor, ease: "power3.out" },
            "-=0.1"
          );
        }
      } else if (kind === "list") {
        if (preset === "bullet_cards_lesson" || preset === "bullet_cards_premium") {
          const cards = el.querySelectorAll(".bullet-card");
          if (cards.length) {
            tl.fromTo(cards,
              { opacity: 0, y: 20 },
              { opacity: 1, y: 0, duration: 0.32 * durationFactor, stagger: 0.1 * durationFactor, ease: "power2.out" },
              "-=0.1"
            );
          }
        } else {
          const items = el.querySelectorAll(".check-item");
          if (items.length) {
            tl.fromTo(items,
              { opacity: 0, y: 14 },
              { opacity: 1, y: 0, duration: 0.24 * durationFactor, stagger: 0.08 * durationFactor, ease: "power1.out" },
              "-=0.1"
            );
          }
        }
      } else if (kind === "accent") {
        if (preset === "myth_strike_redline") {
          const myth = el.querySelector(".myth-word");
          const truth = el.querySelector(".truth-word");
          if (myth) {
            tl.fromTo(myth, { opacity: 0, x: -28 }, { opacity: 1, x: 0, duration: 0.26 * durationFactor, ease: "power3.out" }, "-=0.1");
            tl.fromTo(myth, { "--strike-scale": 0 }, { "--strike-scale": 1, duration: 0.3 * durationFactor, ease: "power2.inOut" }, "+=0.1");
          }
          if (truth) {
            tl.fromTo(truth, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.28 * durationFactor, ease: "back.out(1.35)" }, "-=0.08");
          }
        } else if (preset === "concept_orbit_map") {
          const center = el.querySelector(".concept-center");
          const nodes = el.querySelectorAll(".concept-node");
          if (center) {
            tl.fromTo(center, { opacity: 0, scale: 0.78 }, { opacity: 1, scale: 1, duration: 0.34 * durationFactor, ease: "back.out(1.35)" }, "-=0.1");
          }
          if (nodes.length) {
            tl.fromTo(nodes, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.3 * durationFactor, stagger: 0.1 * durationFactor, ease: "power3.out" }, "-=0.15");
          }
        } else {
          const keyword = el.querySelector(".keyword");
          const eyebrow = el.querySelector(".eyebrow");
          const subtext = el.querySelector(".subtext");
          const elements = [eyebrow, keyword, subtext].filter(Boolean);
          if (elements.length) {
            tl.fromTo(elements,
              { opacity: 0, y: 14 },
              { opacity: 1, y: 0, duration: 0.26 * durationFactor, stagger: 0.06 * durationFactor, ease: "power2.out" },
              "-=0.1"
            );
          }
        }
      } else if (kind === "cta") {
        const items = el.querySelectorAll("strong, small");
        if (items.length) {
          tl.fromTo(items,
            { opacity: 0, scale: 0.92 },
            { opacity: 1, scale: 1, duration: 0.3 * durationFactor, stagger: 0.1 * durationFactor, ease: "back.out(1.1)" },
            "-=0.1"
          );
        }
      }

      // Exit animation
      const animationOut = block.animationOut ?? "slide-up";
      let exitVars = { opacity: 0, y: "-=18", scale: 0.58, ease: "power2.in", duration: 0.24 };
      if (animationOut === "fade") {
        exitVars = { opacity: 0, scale: 0.58, ease: "power2.in", duration: 0.24 } as any;
      } else if (animationOut === "slide-down") {
        exitVars = { opacity: 0, y: "+=18", scale: 0.58, ease: "power2.in", duration: 0.24 } as any;
      } else if (animationOut === "scale-down") {
        exitVars = { opacity: 0, scale: 0.44, ease: "power2.in", duration: 0.24 } as any;
      } else if (animationOut === "none") {
        exitVars = { opacity: 0, ease: "none", duration: 0.01 } as any;
      }
      tl.to(el, exitVars, "+=1.5");
    }, el);

    return () => ctx.revert();
  }, [animationTrigger, block.font, block.surface, block.shadow, block.animationSpeed, block.animationIn, block.animationOut, kind, block.layoutPreset]);

  return (
    <div className={`${styles.stage} ${styles.aspect_portrait}`} ref={stageRef}>
      <div className={styles.phoneVideo} />
      <button className={styles.replayBtn} type="button" onClick={onReplay} aria-label="Воспроизвести анимацию">
        <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
      </button>
      <div ref={overlayRef} className={`${styles.overlay} ${styles.freePosition} ${styles[`kind_${kind}`]} ${styles[`surface_${block.surface ?? theme.defaultSurface}`]} ${styles[`shadow_${block.shadow ?? theme.defaultShadow}`]} ${styles[`font_${block.font ?? theme.font}`]} preset-${block.layoutPreset ?? ""}`} style={overlayStyle}>
        <OverlayContent kind={kind} accentColor={String(block.colorAccent ?? theme.colorPrimary)} fontSize={fontSize} weight={weight} block={block} theme={theme} />
      </div>
      {dragEnabled ? (
        <button
          className={styles.dragHandle}
          type="button"
          style={{ left: `${position.x}%`, top: `${position.y}%` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          aria-label="Перетащить позицию блока"
        />
      ) : null}
    </div>
  );
}

function OverlayContent({ kind, accentColor, fontSize, weight, block, theme }: {
  kind: string;
  accentColor: string;
  fontSize: number;
  weight: number;
  block: any;
  theme: any;
}) {
  const titleStyle = { fontSize, fontWeight: weight };
  const preset = block.layoutPreset ?? "";

  if (kind === "title") {
    if (preset === "lesson_title_cinematic") {
      return (
        <div className="lesson-card cinematic" style={{ padding: "10px 12px", textAlign: "center" }}>
          <div className="eyebrow" style={{ fontSize: "9px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.2em" }}>CHAPTER I</div>
          <div className="lesson-title" style={{ fontSize: `${fontSize * 0.75}px`, fontWeight: 300, color: "#ffffff", fontFamily: "Georgia, serif", fontStyle: "italic", marginTop: "4px" }}>Глубина резкости</div>
        </div>
      );
    }
    return (
      <div className="lesson-card" style={{ padding: "14px 16px", display: "grid", gap: "2px" }}>
        <div className="eyebrow" style={{ fontSize: "10px", color: accentColor, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 900 }}>УРОК 01</div>
        <div className="lesson-title" style={{ fontSize: `${fontSize * 0.8}px`, fontWeight: 950, textTransform: "uppercase", color: "#ffffff" }}>Сначала система</div>
        <p className="lesson-subtext" style={{ fontSize: "13px", color: "var(--muted)", margin: "4px 0 0" }}>построим понятный и масштабируемый процесс</p>
      </div>
    );
  }

  if (kind === "number") {
    if (preset === "hud_ratio_panel") {
      return (
        <div className="stat-card" style={{ padding: "12px", display: "grid", gap: "6px" }}>
          <div className="eyebrow" style={{ fontSize: "9px", color: "var(--muted)", textTransform: "uppercase" }}>показатели</div>
          <div className="stat-list" style={{ display: "grid", gap: "6px" }}>
            <div className="stat-row" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 10px", borderRadius: "8px", background: "rgba(10,30,50,0.6)", border: "1px solid rgba(115,200,255,0.12)" }}>
              <span className="stat-value" style={{ fontSize: "18px", fontWeight: 900, color: accentColor }}>84%</span>
              <span className="stat-label" style={{ fontSize: "12px", color: "#f0f5ff" }}>Продуктивность</span>
            </div>
            <div className="stat-row" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 10px", borderRadius: "8px", background: "rgba(10,30,50,0.6)", border: "1px solid rgba(115,200,255,0.12)" }}>
              <span className="stat-value" style={{ fontSize: "18px", fontWeight: 900, color: accentColor }}>12x</span>
              <span className="stat-label" style={{ fontSize: "12px", color: "#f0f5ff" }}>Рендеринг</span>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="glass-card big-number" style={{ padding: "12px 14px" }}>
        <span className="number-value" style={{ fontSize: `${fontSize * 1.15}px`, color: accentColor, fontWeight: 950, display: "block" }}>70%</span>
        <p className="number-label" style={{ margin: "2px 0 0", color: "var(--muted)", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.06em" }}>меньше рутины</p>
      </div>
    );
  }

  if (kind === "chart") {
    return (
      <div className="chart-card" style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginBottom: "8px" }}>
          <span className="eyebrow" style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase" }}>рост</span>
          <div className="chart-title" style={{ fontSize: `${fontSize * 0.7}px`, fontWeight: 900 }}>+140%</div>
        </div>
        <div className="chart-bars" style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "50px" }}>
          <div className="bar-wrap" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span className="bar" style={{ display: "block", width: "10px", height: "20px", background: `linear-gradient(180deg, ${accentColor}, rgba(255,255,255,0.06))`, borderRadius: "3px 3px 0 0", transformOrigin: "bottom center" }} />
          </div>
          <div className="bar-wrap" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span className="bar" style={{ display: "block", width: "10px", height: "35px", background: `linear-gradient(180deg, ${accentColor}, rgba(255,255,255,0.06))`, borderRadius: "3px 3px 0 0", transformOrigin: "bottom center" }} />
          </div>
          <div className="bar-wrap" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span className="bar" style={{ display: "block", width: "10px", height: "48px", background: `linear-gradient(180deg, ${accentColor}, rgba(255,255,255,0.06))`, borderRadius: "3px 3px 0 0", transformOrigin: "bottom center" }} />
          </div>
        </div>
      </div>
    );
  }

  if (kind === "list") {
    if (preset === "bullet_cards_lesson" || preset === "bullet_cards_premium") {
      return (
        <div className="bullet-shell" style={{ padding: "12px", display: "grid", gap: "6px" }}>
          <div className="eyebrow" style={{ fontSize: "9px", color: "var(--muted)", textTransform: "uppercase" }}>структура</div>
          <div className="bullet-grid" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <article className="bullet-card" style={{ padding: "8px 10px", display: "flex", gap: "8px", borderRadius: "10px", background: "rgba(15,33,57,0.72)", border: "1px solid rgba(36,71,97,0.48)" }}>
              <span className="bullet-index" style={{ color: accentColor, fontWeight: 900, fontSize: "13px" }}>01</span>
              <p className="bullet-text" style={{ fontSize: "13px", margin: 0 }}>Настройка процессов</p>
            </article>
            <article className="bullet-card" style={{ padding: "8px 10px", display: "flex", gap: "8px", borderRadius: "10px", background: "rgba(15,33,57,0.72)", border: "1px solid rgba(36,71,97,0.48)" }}>
              <span className="bullet-index" style={{ color: accentColor, fontWeight: 900, fontSize: "13px" }}>02</span>
              <p className="bullet-text" style={{ fontSize: "13px", margin: 0 }}>Автоматизация сборки</p>
            </article>
          </div>
        </div>
      );
    }
    return (
      <div className="checklist-card" style={{ padding: "12px 14px" }}>
        <div className="checklist-title" style={{ fontSize: `${fontSize * 0.6}px`, fontWeight: 900, marginBottom: "6px", textTransform: "uppercase" }}>3 правила</div>
        <ul className="check-list" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
          <li className="check-item" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
            <span className="check-dot" style={{ width: "6px", height: "6px", borderRadius: preset === "checklist_steps" ? "2px" : "50%", backgroundColor: accentColor }} />
            <span>Порядок</span>
          </li>
          <li className="check-item" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
            <span className="check-dot" style={{ width: "6px", height: "6px", borderRadius: preset === "checklist_steps" ? "2px" : "50%", backgroundColor: accentColor }} />
            <span>Процесс</span>
          </li>
          <li className="check-item" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
            <span className="check-dot" style={{ width: "6px", height: "6px", borderRadius: preset === "checklist_steps" ? "2px" : "50%", backgroundColor: accentColor }} />
            <span>Автоматизация</span>
          </li>
        </ul>
      </div>
    );
  }

  if (kind === "accent") {
    if (preset === "myth_strike_redline") {
      return (
        <div className="myth-card" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div className="eyebrow" style={{ fontSize: "9px", color: "var(--muted)", textTransform: "uppercase" }}>сравнение</div>
          <div className="myth-word" style={{ fontSize: `${fontSize * 0.7}px`, fontWeight: 900, textTransform: "uppercase", color: "rgba(255,255,255,0.48)", position: "relative", alignSelf: "flex-start", display: "inline-block" }}>
            МИФ
            <span className="strike-line" style={{ position: "absolute", left: "-2%", right: "-2%", top: "48%", height: "3px", backgroundColor: "#ff5d4d", transform: "scaleX(var(--strike-scale, 0))", transformOrigin: "left center", borderRadius: "1px" }} />
          </div>
          <div className="truth-word" style={{ fontSize: `${fontSize * 0.7}px`, fontWeight: 900, textTransform: "uppercase", color: accentColor }}>ФАКТ</div>
        </div>
      );
    }

    if (preset === "compare_before_after") {
      return (
        <div className="myth-card compare" style={{ padding: "12px 14px", display: "flex", gap: "10px" }}>
          <div style={{ flex: 1, padding: "6px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", textAlign: "center" }}>
            <div style={{ fontSize: "8px", color: "var(--muted)" }}>ДО</div>
            <div className="myth-word" style={{ fontSize: "14px", fontWeight: 900, position: "relative", display: "inline-block" }}>
              Хаос
              <span className="strike-line" style={{ position: "absolute", left: "-2%", right: "-2%", top: "48%", height: "2px", backgroundColor: "#ff5d4d", transform: "scaleX(var(--strike-scale, 0))", transformOrigin: "left center" }} />
            </div>
          </div>
          <div style={{ flex: 1, padding: "6px", borderRadius: "8px", border: "1px solid rgba(115,200,255,0.22)", background: "rgba(115,200,255,0.06)", textAlign: "center" }}>
            <div style={{ fontSize: "8px", color: accentColor }}>ПОСЛЕ</div>
            <div className="truth-word" style={{ fontSize: "14px", fontWeight: 900, color: accentColor }}>Порядок</div>
          </div>
        </div>
      );
    }

    if (preset === "concept_orbit_map") {
      return (
        <div className="concept-card" style={{ padding: "12px", display: "grid", gap: "8px" }}>
          <div className="eyebrow" style={{ fontSize: "9px", color: "var(--muted)", textTransform: "uppercase" }}>схема</div>
          <div className="concept-grid" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div className="concept-node" style={{ flex: 1, padding: "4px", fontSize: "10px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", background: "rgba(0,0,0,0.2)", textAlign: "center" }}>Вход</div>
            <div className="concept-center" style={{ width: "32px", height: "32px", display: "grid", placeItems: "center", borderRadius: "50%", background: accentColor, color: "#000", fontWeight: 900, fontSize: "10px", boxShadow: `0 0 10px ${accentColor}` }}>AI</div>
            <div className="concept-node" style={{ flex: 1, padding: "4px", fontSize: "10px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", background: "rgba(0,0,0,0.2)", textAlign: "center" }}>Выход</div>
          </div>
        </div>
      );
    }

    return (
      <div className="accent-card" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
        <div className="eyebrow" style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase" }}>
          {preset === "keyword_warning_strip" ? "⚠️ Внимание" : preset === "quote_emphasis" ? "Цитата" : "акцент"}
        </div>
        <strong style={titleStyle} className="keyword">Сначала система</strong>
        <span className="subtext" style={{ fontSize: "13px", color: "var(--muted)" }}>потом масштаб</span>
      </div>
    );
  }

  if (kind === "cta") {
    if (preset === "cta_finish_premium") {
      return (
        <div className="cta-card premium" style={{ padding: "12px", border: "1px solid rgba(216,197,161,0.24)", background: "#241f18", textAlign: "center" }}>
          <strong style={{ ...titleStyle, color: accentColor }}>Подпишись</strong>
          <small style={{ fontSize: "11px", color: "#c9bda8", display: "block", marginTop: "2px" }}>и получай лучшие разборы процессов</small>
        </div>
      );
    }
    if (preset === "cta_finish_viral") {
      return (
        <div className="cta-card viral" style={{ padding: "12px", background: "#11", border: "1px solid rgba(255,64,64,0.24)", textAlign: "center" }}>
          <strong style={{ ...titleStyle, color: "#ff4040" }}>ЗАБЕРИ СВОЕ</strong>
          <small style={{ fontSize: "11px", color: "var(--muted)", display: "block", marginTop: "2px" }}>ссылка в описании профиля</small>
        </div>
      );
    }
    return (
      <div className="cta-card" style={{ padding: "12px 14px", textAlign: "center", display: "flex", flexDirection: "column", gap: "4px" }}>
        <strong style={titleStyle}>Сохрани</strong>
        <small style={{ fontSize: "12px", color: "var(--muted)", display: "block" }}>и проверь один процесс сегодня</small>
      </div>
    );
  }

  if (kind === "text") {
    return (
      <div className="phrase-card" style={{ display: "flex", flexWrap: "wrap", gap: "4px 6px", padding: "10px 12px", fontSize: `${fontSize}px`, fontWeight: weight }}>
        {splitTextToSpans("Не улучшайте все сразу", "сразу", preset, accentColor, block.colorText ?? theme.colorText)}
      </div>
    );
  }

  if (kind === "surface") {
    return (
      <div className="phrase-card" style={{ display: "flex", flexWrap: "wrap", gap: "4px 6px", padding: "10px 12px", fontSize: `${fontSize}px`, fontWeight: weight }}>
        {splitTextToSpans("Глобальный стиль шаблона", "шаблона", preset, accentColor, block.colorText ?? theme.colorText)}
      </div>
    );
  }

  return (
    <div className="phrase-card" style={{ display: "flex", flexWrap: "wrap", gap: "4px 6px", padding: "10px 12px", fontSize: `${fontSize}px`, fontWeight: weight }}>
      {splitTextToSpans("Главный инсайт ролика", "инсайт", preset, accentColor, block.colorText ?? theme.colorText)}
    </div>
  );
}

function EditorSection({ section, open, children, onOpen, onSave, onCancel, status }: { section: SectionId; open: boolean; children: ReactNode; onOpen: () => void; onSave: () => void; onCancel: () => void; status: Status }) {
  return (
    <section className={styles.group}>
      <button className={styles.sectionHead} type="button" onClick={onOpen}>
        <span>{sectionLabels[section]}</span><b>{open ? "Свернуть" : "Открыть"}</b>
      </button>
      <div className={`${styles.sectionPanel} ${open ? styles.sectionPanelOpen : ""}`}>
        <div className={styles.sectionPanelInner}>
          <div className={styles.sectionBody}>
            {children}
            <div className={styles.sectionActions}>
              <button type="button" onClick={onCancel}>Отменить</button>
              <button type="button" onClick={onSave}>{status === "saving" ? "Сохраняю..." : "Сохранить"}</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PositionControls({ position, onChange }: { position: TemplatePosition; onChange: (position: TemplatePosition) => void }) {
  return <><ChoiceGrid items={[{ id: "left", label: "Лево" }, { id: "right", label: "Право" }, { id: "center", label: "Центр" }, { id: "bottom", label: "Низ" }]} value={position.anchor} onChange={(anchor) => onChange(positionForAnchor(anchor as TemplateAnchor))} /><Range label="X %" value={Math.round(position.x)} min={0} max={100} onChange={(x) => onChange({ ...position, x })} /><Range label="Y %" value={Math.round(position.y)} min={0} max={100} onChange={(y) => onChange({ ...position, y })} /></>;
}

function ColorControls({ tab, block, template, updateTheme, updateBlock }: ControlProps) {
  if (tab === "theme") return <><TemplateColorPicker label="Текст" value={template.theme.colorText} onChange={(colorText) => updateTheme({ colorText })} /><TemplateColorPicker label="Accent" value={template.theme.colorPrimary} onChange={(colorPrimary) => updateTheme({ colorPrimary })} /><TemplateColorPicker label="Background" value={template.theme.colorBackground} onChange={(colorBackground) => updateTheme({ colorBackground })} /></>;
  return <><TemplateColorPicker label="Текст" value={block?.colorText ?? template.theme.colorText} onChange={(colorText) => updateBlock({ colorText })} /><TemplateColorPicker label="Accent" value={block?.colorAccent ?? template.theme.colorPrimary} onChange={(colorAccent) => updateBlock({ colorAccent })} /><TemplateColorPicker label="Background" value={block?.colorBackground ?? template.theme.colorBackground} onChange={(colorBackground) => updateBlock({ colorBackground })} /><button className={styles.inlineButton} type="button" onClick={() => updateBlock({ colorText: null, colorAccent: null, colorBackground: null })}>Взять из темы</button></>;
}

function TypographyControls({ tab, block, template, updateTheme, updateBlock }: ControlProps) {
  const font = tab === "theme" ? template.theme.font : String(block?.font ?? template.theme.font);
  const fontSize = numberValue(block?.fontSize, 58);
  const weight = numberValue(block?.fontWeight, 900);
  return <><ChoiceGrid items={templateFonts} value={font} onChange={(value) => tab === "theme" ? updateTheme({ font: value as never }) : updateBlock({ font: value })} />{tab !== "theme" ? <><Range label="Размер" value={fontSize} min={20} max={96} onChange={(fontSize) => updateBlock({ fontSize })} /><Range label="Жирность" value={weight} min={400} max={950} step={50} onChange={(fontWeight) => updateBlock({ fontWeight })} /></> : null}</>;
}

function SurfaceControls({ tab, block, template, updateTheme, updateBlock }: ControlProps) {
  const surface = tab === "theme" ? template.theme.defaultSurface : block?.surface ?? template.theme.defaultSurface;
  return <><ChoiceGrid items={templateSurfaces} value={surface} onChange={(value) => tab === "theme" ? updateTheme({ defaultSurface: value as never }) : updateBlock({ surface: value })} />{tab !== "theme" ? <><Range label="Скругление" value={numberValue(block?.borderRadius, 22)} min={4} max={44} onChange={(borderRadius) => updateBlock({ borderRadius })} /><Range label="Отступы" value={numberValue(block?.padding, 22)} min={10} max={42} onChange={(padding) => updateBlock({ padding })} /><Range label="Прозрачность" value={Math.round(numberValue(block?.surfaceOpacity, 0.82) * 100)} min={0} max={100} onChange={(value) => updateBlock({ surfaceOpacity: value / 100 })} /></> : null}</>;
}

function MotionControls({ tab, block, template, updateTheme, updateBlock }: ControlProps) {
  const shadow = tab === "theme" ? template.theme.defaultShadow : block?.shadow ?? template.theme.defaultShadow;
  const speed = tab === "theme" ? template.theme.defaultAnimationSpeed : numberValue(block?.animationSpeed, template.theme.defaultAnimationSpeed);
  return <><ChoiceGrid items={templateShadows} value={shadow} onChange={(value) => tab === "theme" ? updateTheme({ defaultShadow: value as never }) : updateBlock({ shadow: value })} /><Range label="Скорость" value={Math.round(speed * 100)} min={0} max={100} onChange={(value) => tab === "theme" ? updateTheme({ defaultAnimationSpeed: value / 100 }) : updateBlock({ animationSpeed: value / 100 })} />{tab !== "theme" ? <ChoiceGrid items={templateAnimations} value={String(block?.animationIn ?? "slide-up")} onChange={(animationIn) => updateBlock({ animationIn })} /> : null}</>;
}

function ToggleRow({ block, onChange }: { block: TemplateBlockBase; onChange: (enabled: boolean) => void }) {
  return <label className={styles.toggleRow}><span>Разрешить AI использовать этот блок</span><input type="checkbox" checked={block.enabled} onChange={(event) => onChange(event.target.checked)} /></label>;
}

type ControlProps = {
  tab: TemplateEditorTab;
  block: (TemplateBlockBase & Record<string, unknown>) | null;
  template: VisualTemplateData;
  updateTheme: (patch: Partial<VisualTemplateData["theme"]>) => void;
  updateBlock: (patch: Partial<TemplateBlockBase> & Record<string, unknown>) => void;
};

function ChoiceGrid<T extends string>({ items, value, onChange }: { items: Array<{ id: T; label: string }>; value: string | T; onChange: (value: T) => void }) {
  return <div className={styles.choiceGrid}>{items.map((item) => <button className={value === item.id ? styles.choiceActive : ""} key={item.id} type="button" onClick={() => onChange(item.id)}>{item.label}</button>)}</div>;
}

function Range({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return <label className={styles.rangeRow}><span>{label}</span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /><code>{value}</code></label>;
}

function themeAsBlock(template: VisualTemplateData): TemplateBlockBase & Record<string, unknown> {
  return {
    enabled: true,
    position: template.theme.defaultPosition,
    surface: template.theme.defaultSurface,
    surfaceOpacity: 0.82,
    borderRadius: 24,
    padding: 24,
    shadow: template.theme.defaultShadow,
    animationSpeed: template.theme.defaultAnimationSpeed,
    colorText: template.theme.colorText,
    colorBackground: template.theme.colorBackground,
    colorAccent: template.theme.colorPrimary,
    font: template.theme.font,
    fontSize: 58,
    fontWeight: 900
  };
}

function upsertTemplate(items: StoredTemplate[], template: StoredTemplate) {
  const next = items.filter((item) => item.id !== template.id);
  return [template, ...next];
}

function snapAnchor(x: number, y: number): TemplateAnchor {
  if (y > 78) return "bottom";
  if (Math.abs(x - 50) <= 8) return "center";
  if (x < 30) return "left";
  if (x > 70) return "right";
  return "center";
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
