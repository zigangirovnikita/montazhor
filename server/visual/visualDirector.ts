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

  let parsedResponse;
  let useFallback = false;

  try {
    const response = await callChatCompletion(config, systemPrompt, userPrompt);
    
    await recordAiUsage({ 
      projectId, 
      source: "hyperframes", 
      phase: "visual_director", 
      result: response 
    });

    const jsonParsed = JSON.parse(response.content);
    const validated = templateInstancePlanSchema.safeParse(jsonParsed);
    
    if (validated.success) {
      parsedResponse = validated.data;
    } else {
      console.warn("Visual Director schema validation failed:", validated.error);
      useFallback = true;
    }
  } catch (err) {
    console.warn("Visual Director LLM call or JSON parsing failed:", err);
    useFallback = true;
  }

  if (useFallback || !parsedResponse) {
    return buildFallbackPlan(beats);
  }

  return {
    stylePack: parsedResponse.stylePack,
    captionMode: "off",
    planner: "ai",
    diagnostics: [`AI selected ${parsedResponse.instances.length} template instances from ${beats.length} beats.`],
    instances: parsedResponse.instances.map((inst: any) => ({
      id: `inst-${Math.random().toString(36).slice(2, 8)}`,
      start: inst.start,
      duration: inst.duration,
      templateId: inst.templateId,
      variantId: inst.variantId || "standard",
      visualWeight: inst.visualWeight as any,
      slots: inst.slots,
      transitionIn: inst.transitionIn || "fade",
      transitionOut: inst.transitionOut || "cut"
    }))
  };
}

function buildFallbackPlan(beats: VisualBeat[]): TemplateInstancePlan {
  const instances = beats.map((b, i) => {
    let templateId = "ais.side_callout.v1";
    let slots: Record<string, any> = { text: b.text.slice(0, 50) };
    let visualWeight = "callout";

    if (b.intent === "hook") {
      templateId = "ais.hook_flash.v1";
      slots = { title: b.text.slice(0, 30) };
      visualWeight = "full";
    } else if (b.intent === "stat") {
      templateId = "ais.stat_meter.v1";
      slots = { label: b.text.slice(0, 30), value: "100" };
      visualWeight = "medium";
    } else if (b.intent === "mistake" || b.intent === "comparison") {
      templateId = "ais.myth_strike_overlay.v1";
      slots = { wrong: "Ожидание", right: b.text.slice(0, 30) };
      visualWeight = "medium";
    } else if (b.intent === "steps") {
      templateId = "ais.steps_cards.v1";
      slots = { steps: [b.text.slice(0, 30)] };
      visualWeight = "full";
    } else if (b.intent === "cta") {
      templateId = "ais.cta_flash.v1";
      slots = { action: b.text.slice(0, 30) };
      visualWeight = "full";
    }

    return {
      id: `inst-fb-${i}`,
      start: b.start,
      duration: b.end - b.start,
      templateId,
      variantId: "standard",
      visualWeight: visualWeight as any,
      slots,
      transitionIn: "fade" as const,
      transitionOut: "cut" as const
    };
  });

  return {
    stylePack: "ais_tech",
    captionMode: "off",
    planner: "deterministic",
    diagnostics: ["Used deterministic fallback due to LLM parsing failure."],
    instances
  };
}
