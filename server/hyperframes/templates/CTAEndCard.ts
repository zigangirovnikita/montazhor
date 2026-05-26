import { baseTemplate } from "@/server/hyperframes/templates/HookTitleCard";

export function ctaTemplate(text: string, preset: string) {
  return baseTemplate("cta-end", text, preset, "NEXT STEP");
}
