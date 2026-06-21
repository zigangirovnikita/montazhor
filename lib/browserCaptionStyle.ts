export type BrowserCaptionStyleVariant = "bold-yellow" | "clean-white" | "premium-minimal";

export function browserCaptionStyleForPreset(stylePreset?: string | null): BrowserCaptionStyleVariant {
  if (stylePreset === "premium_calm") return "premium-minimal";
  if (stylePreset === "dynamic_viral" || stylePreset === "viral_kinetic") return "bold-yellow";
  return "clean-white";
}
