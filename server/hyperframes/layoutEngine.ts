import type { VisualBeat, VisualFrameProfile, VisualSafeRegion } from "@/lib/types";
import { safeAreaInsets } from "@/server/hyperframes/designTokens";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function layoutEngine(
  frame: VisualFrameProfile | undefined,
  layout: VisualBeat["layout"],
  safeRegions: VisualSafeRegion[],
  diagnostics: string[],
  beatId: string
): VisualBeat["layout"] {
  if (!frame || safeRegions.length === 0) return layout;

  const candidateLayouts: VisualBeat["layout"][] = [layout, "left", "right", "center", "lower_third", "full_frame"];
  const uniqueLayouts = [...new Set(candidateLayouts)];

  for (const candidate of uniqueLayouts) {
    if (!intersectsSafeRegion(candidateBox(frame, candidate), safeRegions)) {
      if (candidate !== layout) {
        diagnostics.push(`${beatId}: layout moved from ${layout} to ${candidate} to avoid safe region overlap.`);
      }
      return candidate;
    }
  }

  diagnostics.push(`${beatId}: all layouts intersect safe regions; keeping ${layout}.`);
  return layout;
}

export function candidateBox(frame: VisualFrameProfile, layout: VisualBeat["layout"]): BoundingBox {
  const insets = safeAreaInsets[frame.orientation];
  const safeWidth = frame.width - insets.left - insets.right;
  const safeHeight = frame.height - insets.top - insets.bottom;

  if (frame.orientation === "portrait") {
    const x = insets.left;
    const width = safeWidth;
    
    if (layout === "center") {
      return { x, y: frame.height * 0.56, width, height: safeHeight * 0.22 };
    }
    if (layout === "lower_third") {
      return { x, y: frame.height - insets.bottom - safeHeight * 0.25, width, height: safeHeight * 0.25 };
    }
    return { x, y: frame.height * 0.62, width, height: safeHeight * 0.22 };
  }

  // Landscape
  const contentY = insets.top;
  
  if (layout === "right") {
    return { x: frame.width * 0.54, y: contentY, width: frame.width * 0.4, height: safeHeight * 0.45 };
  }
  if (layout === "center") {
    return { x: frame.width * 0.27, y: frame.height * 0.28, width: safeWidth * 0.55, height: safeHeight * 0.4 };
  }
  if (layout === "lower_third") {
    return { x: insets.left, y: frame.height - insets.bottom - safeHeight * 0.2, width: safeWidth * 0.5, height: safeHeight * 0.2 };
  }
  if (layout === "full_frame") {
    return { x: insets.left, y: contentY, width: safeWidth * 0.5, height: safeHeight * 0.5 };
  }
  return { x: insets.left, y: contentY, width: safeWidth * 0.5, height: safeHeight * 0.45 };
}

export function intersectsSafeRegion(box: BoundingBox, safeRegions: VisualSafeRegion[]): boolean {
  return safeRegions.some((region) => {
    const overlapX = Math.max(0, Math.min(box.x + box.width, region.x + region.width) - Math.max(box.x, region.x));
    const overlapY = Math.max(0, Math.min(box.y + box.height, region.y + region.height) - Math.max(box.y, region.y));
    return overlapX * overlapY > 0;
  });
}
