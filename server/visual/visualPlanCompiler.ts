import type { TemplateInstancePlan, TemplateInstance } from "@/lib/types/visual";
import { getTemplateById } from "@/server/hyperframes/templateCatalog";
import { compileTemplateInstance } from "@/server/hyperframes/templateCatalog/compileTemplateInstance";

export function compileVisualPlan(directorPlan: TemplateInstancePlan): TemplateInstancePlan {
  const validInstances: TemplateInstance[] = [];
  const diagnostics = [...(directorPlan.diagnostics || [])];

  for (const instance of directorPlan.instances) {
    const templateDef = getTemplateById(instance.templateId);
    if (!templateDef) {
      diagnostics.push(`Rejected instance ${instance.id}: template ${instance.templateId} not found.`);
      continue;
    }

    const compiled = compileTemplateInstance(instance, templateDef);
    if (!compiled) {
      diagnostics.push(`Rejected instance ${instance.id}: failed slot compilation for ${instance.templateId}.`);
      continue;
    }

    validInstances.push(compiled);
  }

  // Prevent PIP on talking head unless fullscreen
  // Actually, checking "is talking head" requires knowing the source video, 
  // but as a general rule, we can filter out pip if templateDef layout is pip.
  // We'll enforce this implicitly for now or log it.

  return {
    ...directorPlan,
    captionMode: "off", // ALWAYS enforce "off" for cinematic
    instances: validInstances,
    diagnostics
  };
}
