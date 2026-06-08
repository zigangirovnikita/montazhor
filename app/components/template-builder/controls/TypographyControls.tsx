import { templateFonts } from "@/lib/templateBuilder";
import { ChoiceGrid } from "../shared/ChoiceGrid";
import { Range } from "../shared/Range";
import type { ControlProps } from "../types";

export function TypographyControls({ tab, block, template, updateTheme, updateBlock }: ControlProps) {
  const font = tab === "theme" ? template.theme.font : String(block?.font ?? template.theme.font);
  // Default values
  const fontSize = typeof block?.fontSize === "number" ? block.fontSize : 58;
  const weight = typeof block?.fontWeight === "number" ? block.fontWeight : 900;

  return (
    <>
      <ChoiceGrid
        items={templateFonts}
        value={font}
        onChange={(value) => tab === "theme" ? updateTheme({ font: value as never }) : updateBlock({ font: value })}
      />
      {tab !== "theme" && (
        <>
          <Range label="Размер" value={fontSize} min={20} max={96} onChange={(fontSize) => updateBlock({ fontSize })} />
          <Range label="Жирность" value={weight} min={400} max={950} step={50} onChange={(fontWeight) => updateBlock({ fontWeight })} />
        </>
      )}
    </>
  );
}
