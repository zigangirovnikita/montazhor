import { useState, useRef, useMemo } from "react";
import { createDefaultTemplate, sanitizeTemplateData, templateToVisualPlanOptions } from "@/lib/templateBuilder";
import type { StoredTemplate, VisualTemplateData, TemplateEditorTab, TemplateBlockBase, TemplatePosition } from "@/lib/templateBuilder";
import type { SectionId, Status } from "../types";
import type { ConfirmState } from "../shared/ConfirmDialog";

export function useTemplateState() {
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

  const [animationTrigger, setAnimationTrigger] = useState(0);

  const isDirty = JSON.stringify(draft) !== snapshot;

  // Bug 10: sync activeTab and elementPreviewKind
  const activeBlock = activeTab === "theme"
    ? null
    : activeTab === "elements"
      ? draft.blocks[elementPreviewKind]
      : draft.blocks[activeTab];

  // Helper inside useTemplateState instead of TemplateBuilder.tsx
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
    };
  }

  const effectiveBlock = activeBlock ?? themeAsBlock(draft);

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

  function openEditorSection(section: SectionId) {
    // Bug 3: sectionSnapshot leak
    // We must check if the section actually has unsaved changes compared to its snapshot
    const currentDraftStr = JSON.stringify(draft);
    if (openSection && sectionSnapshot && currentDraftStr !== sectionSnapshot) {
      requestConfirm({
        title: "Есть несохраненные изменения",
        message: "Переключить раздел? Несохраненные изменения в этом разделе будут потеряны.",
        confirmLabel: "Переключить"
      }, () => {
        const restored = JSON.parse(sectionSnapshot);
        setDraft(restored);
        setOpenSection(section);
        setSectionSnapshot(JSON.stringify(restored)); 
      });
      return;
    }
    setOpenSection(section === openSection ? null : section);
    if (section !== openSection) {
      setSectionSnapshot(currentDraftStr);
    } else {
      setSectionSnapshot(null);
    }
  }

  function cancelEditorSection() {
    // Bug 1: read sectionSnapshot instead of global snapshot
    if (sectionSnapshot) {
      setDraft(JSON.parse(sectionSnapshot));
    }
    setOpenSection(null);
    setSectionSnapshot(null);
    setStatus("idle");
  }

  const optionsSummary = useMemo(() => templateToVisualPlanOptions(draft), [draft]);

  const previewKind = useMemo((): "title" | "text" | "number" | "chart" | "list" | "accent" | "surface" | "cta" => {
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

  return {
    templates,
    setTemplates,
    current,
    setCurrent,
    draft,
    setDraft,
    activeTab,
    elementPreviewKind,
    setElementPreviewKind,
    snapshot,
    setSnapshot,
    status,
    setStatus,
    confirmState,
    openSection,
    setOpenSection,
    sectionSnapshot,
    setSectionSnapshot,
    animationTrigger,
    setAnimationTrigger,
    isDirty,
    activeBlock,
    effectiveBlock,
    optionsSummary,
    previewKind,
    requestConfirm,
    closeConfirm,
    confirmPendingAction,
    switchTab,
    updateName,
    updateTheme,
    updateBlock,
    setPosition,
    openEditorSection,
    cancelEditorSection
  };
}
