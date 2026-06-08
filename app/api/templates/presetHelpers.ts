import { builtinTemplatePresets, sanitizeTemplateData, type StoredTemplate, type VisualTemplateData } from "@/lib/templateBuilder";
import crypto from "crypto";

export function presetIdForName(name: string) {
  const hash = crypto.createHash("md5").update(name).digest("hex").slice(0, 8);
  return `preset:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${hash}`;
}

const PRECOMPUTED_PRESETS: StoredTemplate[] = (() => {
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
})();

export function builtinStoredTemplates(): StoredTemplate[] {
  return PRECOMPUTED_PRESETS;
}

export function builtinTemplateById(id: string): StoredTemplate | undefined {
  return PRECOMPUTED_PRESETS.find((template) => template.id === id);
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

export function serializeTemplate(row: {
  id: string;
  name: string;
  data: unknown;
  isPreset: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    data: sanitizeTemplateData(row.data, row.name),
    isPreset: row.isPreset,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
