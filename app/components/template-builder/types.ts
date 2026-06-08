import type { TemplateBlockBase, VisualTemplateData, TemplateEditorTab } from "@/lib/templateBuilder";

export type SectionId = "position" | "colors" | "typography" | "surface" | "motion";
export type Status = "idle" | "saving" | "saved" | "error";

export type ControlProps = {
  tab: TemplateEditorTab;
  block: (TemplateBlockBase & Record<string, unknown>) | null;
  template: VisualTemplateData;
  updateTheme: (patch: Partial<VisualTemplateData["theme"]>) => void;
  updateBlock: (patch: Partial<TemplateBlockBase> & Record<string, unknown>) => void;
};
