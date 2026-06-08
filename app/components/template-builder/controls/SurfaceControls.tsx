import { templateSurfaces } from "@/lib/templateBuilder";
import { ChoiceGrid } from "../shared/ChoiceGrid";
import { Range } from "../shared/Range";
import type { ControlProps } from "../types";

export function SurfaceControls({ tab, block, template, updateTheme, updateBlock }: ControlProps) {
  const surface = tab === "theme" ? template.theme.defaultSurface : block?.surface ?? template.theme.defaultSurface;
  const borderRadius = typeof block?.borderRadius === "number" ? block.borderRadius : 22;
  const padding = typeof block?.padding === "number" ? block.padding : 22;
  const surfaceOpacity = typeof block?.surfaceOpacity === "number" ? block.surfaceOpacity : 0.82;

  return (
    <>
      <ChoiceGrid
        items={templateSurfaces}
        value={surface}
        onChange={(value) => tab === "theme" ? updateTheme({ defaultSurface: value as never }) : updateBlock({ surface: value })}
      />
      {tab !== "theme" && (
        <>
          <Range label="Скругление" value={borderRadius} min={4} max={44} onChange={(borderRadius) => updateBlock({ borderRadius })} />
          <Range label="Отступы" value={padding} min={10} max={42} onChange={(padding) => updateBlock({ padding })} />
          <Range label="Прозрачность" value={Math.round(surfaceOpacity * 100)} min={0} max={100} onChange={(value) => updateBlock({ surfaceOpacity: value / 100 })} />
        </>
      )}
    </>
  );
}
