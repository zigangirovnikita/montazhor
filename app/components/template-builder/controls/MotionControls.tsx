import { templateAnimations, templateAnimationsOut, templateShadows } from "@/lib/templateBuilder";
import { ChoiceGrid } from "../shared/ChoiceGrid";
import { Range } from "../shared/Range";
import type { ControlProps } from "../types";

export function MotionControls({ tab, block, template, updateTheme, updateBlock }: ControlProps) {
  const shadow = tab === "theme" ? template.theme.defaultShadow : block?.shadow ?? template.theme.defaultShadow;
  const speed = tab === "theme" ? template.theme.defaultAnimationSpeed : (typeof block?.animationSpeed === "number" ? block.animationSpeed : template.theme.defaultAnimationSpeed);

  return (
    <>
      <ChoiceGrid
        items={templateShadows}
        value={shadow}
        onChange={(value) => tab === "theme" ? updateTheme({ defaultShadow: value as never }) : updateBlock({ shadow: value })}
      />
      <Range
        label="Скорость"
        value={Math.round(speed * 100)}
        min={0}
        max={100}
        onChange={(value) => tab === "theme" ? updateTheme({ defaultAnimationSpeed: value / 100 }) : updateBlock({ animationSpeed: value / 100 })}
      />
      {tab !== "theme" && (
        <>
          <ChoiceGrid
            items={templateAnimations}
            value={String(block?.animationIn ?? "slide-up")}
            onChange={(animationIn) => updateBlock({ animationIn })}
          />
          <div style={{ marginTop: "12px", marginBottom: "8px", fontSize: "12px", color: "var(--muted)", textTransform: "uppercase" }}>
            Анимация ухода
          </div>
          <ChoiceGrid
            items={templateAnimationsOut}
            value={String(block?.animationOut ?? "slide-up")}
            onChange={(animationOut) => updateBlock({ animationOut })}
          />
        </>
      )}
    </>
  );
}
