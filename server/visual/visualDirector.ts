import { getAiConfigForTask } from "@/lib/config";
import { callChatCompletion } from "@/server/ai/openRouterClient";
import { recordAiUsage } from "@/server/ai/usage";
import type { VisualBeat, TemplateInstancePlan } from "@/lib/types/visual";
import { templateInstancePlanSchema } from "./visualPlanSchema";
import { templateCatalog } from "@/server/hyperframes/templateCatalog";
import { resolveAppDir } from "@/lib/runtimePaths";

export const VISUAL_DIRECTOR_VERSION = "v1";

export async function buildVisualDirectorPlan(
  projectId: string,
  beats: VisualBeat[],
  duration: number
): Promise<TemplateInstancePlan> {
  const config = getAiConfigForTask("visual_planner"); 
  
  const catalogSummary = templateCatalog.map(t => 
    `- ${t.id} (family: ${t.family}, layout: ${t.layout}, duration: ${t.duration.min}-${t.duration.max}s)\n` +
    `  Slots: ${t.slots.map(s => `${s.name}(${s.type}${s.required ? ", required" : ""})`).join(", ")}`
  ).join("\n\n");

  const beatsSummary = beats.map(b => 
    `[${b.id}] (${b.start.toFixed(1)}s - ${b.end.toFixed(1)}s) [Intent: ${b.intent}, Imp: ${b.importance}]\nText: "${b.text}"`
  ).join("\n\n");

  const systemPrompt = `You are a Visual Director for a cinematic short-form video.
The total video duration is ${duration.toFixed(1)} seconds.

You have a Template Catalog of pre-designed motion graphics elements:
${catalogSummary}

YOUR GOAL:
Choose the best templates from the catalog to visualize the most important beats.
1. DO NOT draw or create custom CSS/HTML. You are ONLY a director choosing from the catalog.
2. Fill the "slots" exactly as required by the chosen template.
3. For text slots, keep them EXTREMELY short. Do not repeat the speaker's exact long sentences.
4. Distribute the visual weight. Don't put "full" weight elements back-to-back.
5. If the source video is a talking head, avoid using "pip" layout to show the speaker over themselves unless it's a fullscreen educational card.

Return a JSON object conforming strictly to the requested output schema.`;

  const userPrompt = JSON.stringify({
    task: "Select templates to visualize the video beats.",
    videoBeats: beatsSummary,
    output_schema: {
      stylePack: "string (e.g. 'ais_tech')",
      instances: [
        {
          beatId: "string (ID of the VisualBeat)",
          templateId: "string (from catalog)",
          variantId: "string (variant of template)",
          start: "number (seconds)",
          duration: "number (seconds)",
          visualWeight: "micro | callout | medium | full",
          slots: {
            "exampleSlot": "exampleValue (do not include HTML/CSS)"
          },
          transitionIn: "fade | slide | zoom | wipe",
          transitionOut: "fade | cut",
          reason: "Why this was chosen"
        }
      ]
    }
  });

  const response = await callChatCompletion(config, systemPrompt, userPrompt);

  await recordAiUsage({ 
    projectId, 
    source: "hyperframes", 
    phase: "visual_director", 
    result: response 
  });

  const parsed = JSON.parse(response.content);

  // Map to the internal type
  return {
    stylePack: parsed.stylePack,
    captionMode: "off", // enforced default
    planner: "ai",
    diagnostics: [`AI selected ${parsed.instances.length} template instances from ${beats.length} beats.`],
    instances: parsed.instances.map((inst: any) => ({
      id: `inst-${Math.random().toString(36).slice(2, 8)}`,
      start: inst.start,
      duration: inst.duration,
      templateId: inst.templateId,
      variantId: inst.variantId || "standard",
      visualWeight: inst.visualWeight,
      slots: inst.slots,
      transitionIn: inst.transitionIn || "fade",
      transitionOut: inst.transitionOut || "cut"
    }))
  };
}
