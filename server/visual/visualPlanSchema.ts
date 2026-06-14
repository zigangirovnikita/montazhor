import { z } from "zod";

export const templateInstanceSchema = z.object({
  beatId: z.string().describe("ID of the VisualBeat this template visualizes"),
  templateId: z.string().describe("The ID of the template from the Template Catalog (e.g., 'ais.hook_flash.v1')"),
  variantId: z.string().describe("Variant of the template (e.g., 'compact', 'hero', 'safe')"),
  start: z.number().describe("Start time in seconds"),
  duration: z.number().describe("Duration in seconds"),
  visualWeight: z.enum(["micro", "callout", "medium", "full"]).describe("Visual weight of the element"),
  slots: z.record(z.string(), z.any()).describe("Key-value mapping matching the template's required slots. Do not write HTML or CSS."),
  transitionIn: z.enum(["fade", "slide", "zoom", "wipe"]).describe("How the element appears"),
  transitionOut: z.enum(["fade", "cut"]).describe("How the element disappears"),
  reason: z.string().describe("Why this template and these slots were chosen")
});

export const templateInstancePlanSchema = z.object({
  stylePack: z.string().describe("The name of the template pack chosen (e.g., 'ais_tech')"),
  instances: z.array(templateInstanceSchema).describe("List of elements to render")
});

export type VisualPlanSchemaResult = z.infer<typeof templateInstancePlanSchema>;
