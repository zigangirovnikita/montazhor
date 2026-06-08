import type { TemplateAnchor } from "@/lib/templateBuilder";

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function snapAnchor(x: number, y: number): TemplateAnchor {
  if (y > 75) return "bottom";
  if (x < 25) return "left";
  if (x > 75) return "right";
  return "center";
}
