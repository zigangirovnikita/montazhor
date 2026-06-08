import type React from "react";
import type { TemplateBlockBase, VisualTemplateData, TemplateEditorTab, StoredTemplate } from "@/lib/templateBuilder";

export type SectionId = "position" | "colors" | "typography" | "surface" | "motion";
export type Status = "idle" | "saving" | "saved" | "error";

export type ControlProps = {
  tab: TemplateEditorTab;
  block: (TemplateBlockBase & Record<string, unknown>) | null;
  template: VisualTemplateData;
  updateTheme: (patch: Partial<VisualTemplateData["theme"]>) => void;
  updateBlock: (patch: Partial<TemplateBlockBase> & Record<string, unknown>) => void;
};

export type UseTemplatePersistProps = {
  current: StoredTemplate | null;
  setCurrent: (t: StoredTemplate) => void;
  draft: VisualTemplateData;
  setDraft: React.Dispatch<React.SetStateAction<VisualTemplateData>>;
  setTemplates: React.Dispatch<React.SetStateAction<StoredTemplate[]>>;
  setSnapshot: React.Dispatch<React.SetStateAction<string>>;
  setStatus: (s: Status) => void;
  setOpenSection: (s: SectionId | null) => void;
  setSectionSnapshot: React.Dispatch<React.SetStateAction<string | null>>;
  isDirty: boolean;
};
