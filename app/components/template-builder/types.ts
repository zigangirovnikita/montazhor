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
  setDraft: (t: VisualTemplateData) => void;
  setTemplates: (updater: any) => void;
  setSnapshot: (s: string) => void;
  setStatus: (s: Status) => void;
  setOpenSection: (s: SectionId | null) => void;
  setSectionSnapshot: (s: string | null) => void;
  isDirty: boolean;
};
