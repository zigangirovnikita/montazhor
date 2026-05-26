import { readFileSync } from "node:fs";
import path from "node:path";

type LocalFont = {
  family: string;
  file: string;
  weight: number;
};

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const SVG_DIR = path.join(process.cwd(), "assets", "svg");

const LOCAL_FONTS: LocalFont[] = [
  { family: "HF Manrope", file: "manrope-800.ttf", weight: 800 },
  { family: "HF Onest", file: "onest-700.ttf", weight: 700 },
  { family: "HF Unbounded", file: "unbounded-700.ttf", weight: 700 },
  { family: "HF Montserrat", file: "montserrat-800.ttf", weight: 800 },
  { family: "HF Golos Text", file: "golos-text-700.ttf", weight: 700 }
];

let fontCssCache: string | null = null;
const svgCache = new Map<string, string>();

export function hyperframesLocalFontsCss() {
  if (fontCssCache) return fontCssCache;

  fontCssCache = LOCAL_FONTS.map((font) => {
    const filePath = path.join(FONT_DIR, font.file);
    const payload = readFileSync(filePath).toString("base64");
    return `@font-face {
      font-family: "${font.family}";
      src: url(data:font/ttf;base64,${payload}) format("truetype");
      font-style: normal;
      font-weight: ${font.weight};
      font-display: swap;
    }`;
  }).join("\n");

  return fontCssCache;
}

export function motionSvg(name: string) {
  const cached = svgCache.get(name);
  if (cached) return cached;

  const value = readFileSync(path.join(SVG_DIR, `${name}.svg`), "utf8")
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/\s(width|height)="[^"]*"/g, "")
    .replace(/\s+/g, " ")
    .trim();

  svgCache.set(name, value);
  return value;
}
