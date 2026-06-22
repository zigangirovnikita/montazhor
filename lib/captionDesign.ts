import { subtitleStyleRecipeOptions } from "./subtitleStyleRecipe";

export type CaptionFontId = "manrope" | "onest" | "unbounded" | "montserrat" | "golos";
export type CaptionBackdrop = "none" | "glass" | "solid";
export type CaptionHighlightMode = "text" | "fill" | "marker";
export type CaptionTextTransform = "none" | "uppercase";
export type CaptionPosition = "lower" | "middle";
export type CaptionSize = "sm" | "md" | "lg";
export type CaptionVariant = "clean" | "viral" | "premium";

export type CaptionDesignInput = {
  styleRecipeId?: string;
  subtitleFont?: CaptionFontId;
  accentFont?: CaptionFontId;
  subtitleStyle?: "clean" | "active_word" | "marker";
  captionAnimation?: "slide_up" | "fade" | "pop";
  accentAnimation?: "text" | "fill" | "marker" | "pulse";
  subtitleBackdrop?: CaptionBackdrop;
  subtitleColor?: string;
  accentColor?: string;
  textCase?: "sentence" | "upper";
  captionPosition?: CaptionPosition;
  captionSize?: CaptionSize;
};

export type CaptionDesign = {
  variant: CaptionVariant;
  fontFamily: string;
  accentFontFamily: string;
  backdrop: CaptionBackdrop;
  textColor: string;
  accentColor: string;
  textTransform: CaptionTextTransform;
  highlightMode: CaptionHighlightMode;
  fontSize: string;
  fontWeight: number;
  letterSpacing: string;
  strokeWidth: number;
  strokeColor: string;
  textShadow: string;
  position: CaptionPosition;
  size: CaptionSize;
  enterAnimation: "slide_up" | "fade" | "pop";
  wordAnimation: "text" | "fill" | "marker" | "pulse";
};

export type LegacyCaptionStyle = "bold-yellow" | "clean-white" | "premium-minimal";

export function buildCaptionDesign(
  stylePreset?: string | null,
  styleOptions?: CaptionDesignInput | null
): CaptionDesign {
  const variant = resolveCaptionVariant(stylePreset);
  const recipeDefaults = subtitleStyleRecipeOptions(styleOptions?.styleRecipeId);
  const fontFamily = captionFontFamily(styleOptions?.subtitleFont ?? recipeDefaults.subtitleFont);
  const accentFontFamily = captionFontFamily(
    styleOptions?.accentFont ??
      recipeDefaults.accentFont ??
      styleOptions?.subtitleFont ??
      recipeDefaults.subtitleFont
  );
  const backdrop = styleOptions?.subtitleBackdrop ?? recipeDefaults.subtitleBackdrop ?? "glass";
  const size = styleOptions?.captionSize ?? recipeDefaults.captionSize ?? "md";
  const textCase = styleOptions?.textCase ?? recipeDefaults.textCase;
  const textTransform = textCase === "upper" ? "uppercase" : "none";
  const enterAnimation =
    styleOptions?.captionAnimation ??
    recipeDefaults.captionAnimation ??
    defaultEnterAnimationForVariant(variant);
  const position = styleOptions?.captionPosition ?? recipeDefaults.captionPosition ?? "lower";

  if (variant === "premium") {
    return {
      variant,
      fontFamily,
      accentFontFamily,
      backdrop,
      textColor: styleOptions?.subtitleColor ?? recipeDefaults.subtitleColor ?? "#fff7e7",
      accentColor: styleOptions?.accentColor ?? recipeDefaults.accentColor ?? "#d7b47f",
      textTransform,
      highlightMode: "text",
      fontSize: fontSizeForVariant(variant, size),
      fontWeight: 700,
      letterSpacing: "-0.035em",
      strokeWidth: 0,
      strokeColor: "transparent",
      textShadow: "0 8px 24px rgba(0, 0, 0, 0.28)",
      position,
      size,
      enterAnimation,
      wordAnimation: styleOptions?.accentAnimation ?? recipeDefaults.accentAnimation ?? "text"
    };
  }

  if (variant === "viral") {
    const highlightMode = resolveHighlightMode(styleOptions, recipeDefaults);
    const wordAnimation = resolveWordAnimation(styleOptions, recipeDefaults, highlightMode);
    return {
      variant,
      fontFamily,
      accentFontFamily,
      backdrop,
      textColor: styleOptions?.subtitleColor ?? recipeDefaults.subtitleColor ?? "#ffffff",
      accentColor: styleOptions?.accentColor ?? recipeDefaults.accentColor ?? "#ffe24f",
      textTransform: textCase === "sentence" ? "none" : "uppercase",
      highlightMode,
      fontSize: fontSizeForVariant(variant, size),
      fontWeight: 900,
      letterSpacing: "-0.04em",
      strokeWidth: 2,
      strokeColor: "rgba(0, 0, 0, 0.9)",
      textShadow: [
        "0 4px 0 rgba(0, 0, 0, 0.42)",
        "0 14px 28px rgba(0, 0, 0, 0.38)",
        "0 0 24px rgba(0, 0, 0, 0.18)"
      ].join(", "),
      position,
      size,
      enterAnimation,
      wordAnimation
    };
  }

  const highlightMode = resolveHighlightMode(styleOptions, recipeDefaults);
  return {
    variant: "clean",
    fontFamily,
    accentFontFamily,
    backdrop,
    textColor: styleOptions?.subtitleColor ?? recipeDefaults.subtitleColor ?? "#ffffff",
    accentColor: styleOptions?.accentColor ?? recipeDefaults.accentColor ?? "#8fd4ff",
    textTransform,
    highlightMode,
    fontSize: fontSizeForVariant("clean", size),
    fontWeight: 800,
    letterSpacing: "-0.03em",
    strokeWidth: 0,
    strokeColor: "transparent",
    textShadow: [
      "0 6px 18px rgba(0, 0, 0, 0.42)",
      "0 0 18px rgba(0, 0, 0, 0.16)"
    ].join(", "),
    position,
    size,
    enterAnimation,
    wordAnimation: resolveWordAnimation(styleOptions, recipeDefaults, highlightMode)
  };
}

export function buildCaptionDesignFromLegacyStyle(style: LegacyCaptionStyle): CaptionDesign {
  if (style === "premium-minimal") return buildCaptionDesign("premium_calm");
  if (style === "bold-yellow") return buildCaptionDesign("dynamic_viral");
  return buildCaptionDesign("clean_expert");
}

export function captionFontFamily(font?: CaptionFontId) {
  if (font === "onest") return '"HF Onest", Arial, sans-serif';
  if (font === "unbounded") return '"HF Unbounded", Arial, sans-serif';
  if (font === "montserrat") return '"HF Montserrat", Arial, sans-serif';
  if (font === "golos") return '"HF Golos Text", Arial, sans-serif';
  return '"HF Manrope", Arial, sans-serif';
}

export function captionBoxBackdropStyles(design: CaptionDesign) {
  if (design.backdrop === "solid") {
    return {
      background: design.variant === "premium"
        ? "rgba(18, 18, 18, 0.7)"
        : "rgba(10, 10, 10, 0.76)",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      boxShadow: "0 18px 36px rgba(0, 0, 0, 0.28)",
      backdropFilter: "none"
    };
  }

  if (design.backdrop === "glass") {
    return {
      background: design.variant === "premium"
        ? "rgba(255, 248, 234, 0.1)"
        : "rgba(12, 15, 20, 0.34)",
      border: "1px solid rgba(255, 255, 255, 0.14)",
      boxShadow: "0 16px 34px rgba(0, 0, 0, 0.16)",
      backdropFilter: "blur(16px)"
    };
  }

  return {
    background: "transparent",
    border: "1px solid transparent",
    boxShadow: "none",
    backdropFilter: "none"
  };
}

function resolveCaptionVariant(stylePreset?: string | null): CaptionVariant {
  if (stylePreset === "premium_calm" || stylePreset === "course_glass") return "premium";
  if (stylePreset === "dynamic_viral" || stylePreset === "viral_kinetic") return "viral";
  return "clean";
}

function resolveHighlightMode(
  styleOptions?: CaptionDesignInput | null,
  recipeDefaults?: Partial<CaptionDesignInput> | null
): CaptionHighlightMode {
  const accentAnimation = styleOptions?.accentAnimation ?? recipeDefaults?.accentAnimation;
  const subtitleStyle = styleOptions?.subtitleStyle ?? recipeDefaults?.subtitleStyle;
  if (accentAnimation === "marker" || subtitleStyle === "marker") return "marker";
  if (accentAnimation === "fill") return "fill";
  if (accentAnimation === "pulse") return "fill";
  return "text";
}

function resolveWordAnimation(
  styleOptions: CaptionDesignInput | null | undefined,
  recipeDefaults: Partial<CaptionDesignInput> | null | undefined,
  highlightMode: CaptionHighlightMode
): CaptionDesign["wordAnimation"] {
  if (styleOptions?.accentAnimation) return styleOptions.accentAnimation;
  if (recipeDefaults?.accentAnimation) return recipeDefaults.accentAnimation;
  if ((styleOptions?.subtitleStyle ?? recipeDefaults?.subtitleStyle) === "marker") return "marker";
  return highlightMode === "fill" ? "fill" : "text";
}

function defaultEnterAnimationForVariant(variant: CaptionVariant): CaptionDesign["enterAnimation"] {
  if (variant === "premium") return "fade";
  if (variant === "viral") return "pop";
  return "slide_up";
}

function fontSizeForVariant(variant: CaptionVariant, size: CaptionSize) {
  if (variant === "premium") {
    if (size === "sm") return "clamp(1.55rem, 3vw, 2.8rem)";
    if (size === "lg") return "clamp(2.2rem, 4.8vw, 4.4rem)";
    return "clamp(1.8rem, 3.8vw, 3.5rem)";
  }

  if (variant === "viral") {
    if (size === "sm") return "clamp(1.7rem, 3.2vw, 3rem)";
    if (size === "lg") return "clamp(2.5rem, 5.1vw, 4.6rem)";
    return "clamp(2rem, 4.4vw, 4.2rem)";
  }

  if (size === "sm") return "clamp(1.55rem, 3vw, 2.8rem)";
  if (size === "lg") return "clamp(2.2rem, 4.8vw, 4.4rem)";
  return "clamp(1.9rem, 4vw, 3.8rem)";
}
