import { aisTechPack } from "./aisTechPack";
import type { MotionTemplateDefinition } from "@/lib/types/visual";

export const templateCatalog: MotionTemplateDefinition[] = [
  ...aisTechPack
];

export function getTemplateById(id: string): MotionTemplateDefinition | undefined {
  return templateCatalog.find(t => t.id === id);
}

export function getTemplatesByFamily(family: string): MotionTemplateDefinition[] {
  return templateCatalog.filter(t => t.family === family);
}
