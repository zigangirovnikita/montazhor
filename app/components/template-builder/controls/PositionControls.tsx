import type { TemplatePosition, TemplateAnchor } from "@/lib/templateBuilder";
import { positionForAnchor } from "@/lib/templateBuilder";
import { ChoiceGrid } from "../shared/ChoiceGrid";
import { Range } from "../shared/Range";

export function PositionControls({
  position,
  onChange
}: {
  position: TemplatePosition;
  onChange: (position: TemplatePosition) => void;
}) {
  return (
    <>
      <ChoiceGrid
        items={[
          { id: "left", label: "Лево" },
          { id: "right", label: "Право" },
          { id: "center", label: "Центр" },
          { id: "bottom", label: "Низ" }
        ]}
        value={position.anchor}
        onChange={(anchor) => {
          // Bug 4 fix: positionForAnchor instead of just passing anchor (which snapAnchor was doing before)
          const newPos = positionForAnchor(anchor as TemplateAnchor);
          onChange(newPos);
        }}
      />
      <Range label="X %" value={Math.round(position.x)} min={0} max={100} onChange={(x) => onChange({ ...position, x })} />
      <Range label="Y %" value={Math.round(position.y)} min={0} max={100} onChange={(y) => onChange({ ...position, y })} />
    </>
  );
}
