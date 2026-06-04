export const typographyScale = {
  xs: 18,
  sm: 22,
  md: 24,
  lg: 34,
  xl: 46,
  xxl: 64,
  hero: 96,
  mega: 128
} as const;

export const spacingScale = {
  none: 0,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  section: 64
} as const;

export const radiusScale = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999
} as const;

export const strokePolicies = {
  heavy: "8px",
  standard: "5px",
  light: "2px",
  none: "0"
} as const;

export const shadows = {
  subtle: "0 2px 12px rgba(0, 0, 0, 0.12)",
  card: "0 4px 14px rgba(0, 0, 0, 0.18)",
  dramatic: "0 18px 54px rgba(0, 0, 0, 0.22)"
} as const;

export const safeAreaInsets = {
  portrait: { top: 88, bottom: 112, left: 60, right: 60 },
  landscape: { top: 40, bottom: 40, left: 44, right: 44 }
} as const;

export const motionCurves = {
  calm: "power2.out",
  active: "power3.out",
  slam: "back.out(1.35)",
  zoom: "expo.out",
  exit: "power2.in"
} as const;

export const motionDurations = {
  enter: { calm: 0.5, medium: 0.38, fast: 0.22 },
  exit: { calm: 0.3, medium: 0.22, fast: 0.16 },
  stagger: { calm: 0.12, medium: 0.09, fast: 0.06 }
} as const;

export const linePolicies = {
  kinetic_text: { maxLines: 3, maxCharsPerLine: 36, minFontSize: 28 },
  keyword_slam: { maxLines: 2, maxCharsPerLine: 20, minFontSize: 18 },
  big_number: { maxLines: 1, maxCharsPerLine: 12, minFontSize: 18 },
  checklist: { maxLines: 6, maxCharsPerLine: 30, minFontSize: 18 },
  metric_chart: { maxLines: 2, maxCharsPerLine: 24, minFontSize: 18 },
  cta_plate: { maxLines: 2, maxCharsPerLine: 28, minFontSize: 18 },
  bullet_cards: { maxLines: 4, maxCharsPerLine: 28, minFontSize: 18 }
} as const;
