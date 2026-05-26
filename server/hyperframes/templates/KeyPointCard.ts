import { baseTemplate } from "@/server/hyperframes/templates/HookTitleCard";

export function keyPointTemplate(text: string, preset: string) {
  return baseTemplate("key-point", text, preset, "IMPORTANT POINT");
}
