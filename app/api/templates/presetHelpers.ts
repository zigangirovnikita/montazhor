import { builtinTemplatePresets, type StoredTemplate, type VisualTemplateData } from "@/lib/templateBuilder";

export function presetIdForName(name: string) {
  return `preset:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export function builtinStoredTemplates(): StoredTemplate[] {
  const now = new Date(0).toISOString();
  return builtinTemplatePresets.map((data) => ({
    id: presetIdForName(data.name),
    name: data.name,
    data,
    isPreset: true,
    isDefault: false,
    createdAt: data.createdAt ?? now,
    updatedAt: data.updatedAt ?? now
  }));
}

export function builtinTemplateById(id: string): StoredTemplate | undefined {
  return builtinStoredTemplates().find((template) => template.id === id);
}

export function clonePresetData(data: VisualTemplateData, name?: string) {
  const now = new Date().toISOString();
  const copy = {
    ...data,
    name: name?.trim() || `${data.name} copy`,
    createdAt: now,
    updatedAt: now,
    blocks: structuredClone(data.blocks),
    theme: structuredClone(data.theme)
  };
  delete copy.id;
  return copy;
}
