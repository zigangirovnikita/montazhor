export type LivePreviewScaleInput = {
  frameWidth: number;
  frameHeight: number;
  stageWidth: number;
  stageHeight: number;
};

export function computeLivePreviewScale(input: LivePreviewScaleInput) {
  if (
    input.frameWidth <= 0
    || input.frameHeight <= 0
    || input.stageWidth <= 0
    || input.stageHeight <= 0
  ) {
    return 1;
  }

  return Math.min(input.stageWidth / input.frameWidth, input.stageHeight / input.frameHeight);
}

export function scalePreviewPx(value: number, scale: number, options?: {
  min?: number;
  max?: number;
}) {
  const scaled = value * (Number.isFinite(scale) && scale > 0 ? scale : 1);
  const min = options?.min ?? Number.NEGATIVE_INFINITY;
  const max = options?.max ?? Number.POSITIVE_INFINITY;
  return clampNumber(scaled, min, max);
}

export function scaleCssPxString(value: string, scale: number) {
  return value.replace(/-?\d*\.?\d+px/g, (match) => {
    const parsed = Number.parseFloat(match.slice(0, -2));
    if (!Number.isFinite(parsed)) return match;
    return `${roundForCss(scalePreviewPx(parsed, scale))}px`;
  });
}

export function resolvePreviewFontSize(fontSize: string, frameWidth: number, scale: number) {
  const canonicalPx = resolveCssLength(fontSize, frameWidth);
  return `${roundForCss(scalePreviewPx(canonicalPx, scale, { min: 10 }))}px`;
}

function resolveCssLength(value: string, frameWidth: number) {
  const source = value.trim();
  const clampMatch = source.match(/^clamp\((.+),(.+),(.+)\)$/i);
  if (clampMatch) {
    const min = resolveCssLengthToken(clampMatch[1], frameWidth);
    const preferred = resolveCssLengthToken(clampMatch[2], frameWidth);
    const max = resolveCssLengthToken(clampMatch[3], frameWidth);
    return clampNumber(preferred, min, max);
  }

  return resolveCssLengthToken(source, frameWidth);
}

function resolveCssLengthToken(value: string, frameWidth: number) {
  const token = value.trim().toLowerCase();
  const parsed = Number.parseFloat(token);
  if (!Number.isFinite(parsed)) return 0;
  if (token.endsWith("rem")) return parsed * 16;
  if (token.endsWith("vw")) return (parsed / 100) * frameWidth;
  if (token.endsWith("px")) return parsed;
  return parsed;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundForCss(value: number) {
  return Math.round(value * 100) / 100;
}
