import type { SemanticBlock } from "@/lib/types";
import type { BrowserFrameCameraMove, BrowserFrameCaption, BrowserFrameVisualBeat } from "./browserFrameRendererPlan";

type CameraAnchor = {
  start: number;
  end: number;
  text: string;
  source: "semantic_block" | "visual_beat" | "caption";
  blockType?: SemanticBlock["type"];
  visualTemplateId?: BrowserFrameVisualBeat["templateId"];
  layout?: BrowserFrameVisualBeat["layout"];
};

type CameraMotionSpec = {
  motionProfile: BrowserFrameCameraMove["motionProfile"];
  maxDuration?: number;
  minDuration?: number;
  scaleFrom: number;
};

export function buildCameraMoves(input: {
  duration: number;
  captions: BrowserFrameCaption[];
  visualBeats?: BrowserFrameVisualBeat[];
  semanticBlocks?: SemanticBlock[] | null;
}) {
  const anchors = buildAnchors(
    input.duration,
    input.captions,
    input.visualBeats ?? [],
    input.semanticBlocks ?? []
  );
  const moves: BrowserFrameCameraMove[] = [];

  for (const [index, anchor] of anchors.entries()) {
    const emphasis = emphasisForAnchor(anchor);
    const layoutBias = layoutBiasFor(anchor.layout, anchor.blockType);
    const motionSpec = motionSpecForAnchor(anchor);
    const window = moveWindowForAnchor(anchor, input.duration, motionSpec);
    if (window.end - window.start < 0.3) continue;

    moves.push({
      id: `camera-${index + 1}`,
      start: window.start,
      end: window.end,
      motionProfile: motionSpec.motionProfile,
      scaleFrom: motionSpec.scaleFrom,
      scaleTo: roundTime(emphasis.scaleTo),
      xFrom: roundTime(layoutBias.xFrom),
      xTo: roundTime(layoutBias.xTo),
      yFrom: roundTime(emphasis.yFrom),
      yTo: roundTime(emphasis.yTo)
    });
  }

  return compressAdjacentMoves(moves);
}

function buildAnchors(
  duration: number,
  captions: BrowserFrameCaption[],
  visualBeats: BrowserFrameVisualBeat[],
  semanticBlocks: SemanticBlock[]
) {
  const anchors: CameraAnchor[] = [];

  for (const block of semanticBlocks) {
    anchors.push({
      start: block.start,
      end: Math.min(duration, Math.max(block.end, block.start + 1.15)),
      text: block.summary || block.text,
      source: "semantic_block",
      blockType: block.type
    });
  }

  for (const beat of visualBeats) {
    const overlapsBlock = semanticBlocks.some((block) => overlapSeconds(block.start, block.end, beat.start, beat.end) > 0.6);
    if (overlapsBlock) continue;
    anchors.push({
      start: beat.start,
      end: beat.end,
      text: visualText(beat),
      source: "visual_beat",
      visualTemplateId: beat.templateId,
      layout: beat.layout
    });
  }

  for (const caption of captions) {
    const overlapsBlock = semanticBlocks.some((block) => overlapSeconds(block.start, block.end, caption.start, caption.end) > 0.6);
    const overlapsVisual = visualBeats.some((beat) => overlapSeconds(beat.start, beat.end, caption.start, caption.end) > 0.55);
    if (overlapsBlock || overlapsVisual) continue;

    anchors.push({
      start: caption.start,
      end: Math.min(duration, Math.max(caption.end, caption.start + 1.1)),
      text: caption.text,
      source: "caption"
    });
  }

  return anchors
    .sort((left, right) => left.start - right.start)
    .slice(0, 64);
}

function emphasisForAnchor(anchor: CameraAnchor) {
  if (anchor.blockType === "cta" || anchor.visualTemplateId === "cta_plate") {
    return { scaleTo: 1.14, yFrom: -0.01, yTo: -0.02 };
  }

  if (anchor.blockType === "hook") {
    return { scaleTo: 1.1, yFrom: -0.008, yTo: -0.016 };
  }

  if (anchor.blockType === "proof" || anchor.blockType === "timeline" || anchor.visualTemplateId === "big_number" || anchor.visualTemplateId === "metric_chart") {
    return { scaleTo: 1.11, yFrom: -0.005, yTo: -0.015 };
  }

  if (anchor.blockType === "comparison" || anchor.blockType === "myth_vs_truth" || anchor.blockType === "warning" || anchor.visualTemplateId === "checklist" || anchor.visualTemplateId === "concept_map" || anchor.visualTemplateId === "myth_strike") {
    return { scaleTo: 1.08, yFrom: 0.006, yTo: -0.01 };
  }

  if (anchor.blockType === "list") {
    return { scaleTo: 1.07, yFrom: 0.004, yTo: -0.008 };
  }

  if (/[0-9%]/.test(anchor.text) || /\bважно|главное|ошибка|результат|система\b/i.test(anchor.text)) {
    return { scaleTo: 1.07, yFrom: 0.004, yTo: -0.008 };
  }

  return { scaleTo: 1.04, yFrom: 0.006, yTo: 0 };
}

function motionSpecForAnchor(anchor: CameraAnchor): CameraMotionSpec {
  if (anchor.blockType === "cta" || anchor.visualTemplateId === "cta_plate") {
    return { motionProfile: "late_punch", minDuration: 0.85, maxDuration: 1.15, scaleFrom: 1.03 };
  }

  if (anchor.blockType === "hook") {
    return { motionProfile: "quick_push", minDuration: 0.9, maxDuration: 1.2, scaleFrom: 1.01 };
  }

  if (
    anchor.blockType === "proof"
    || anchor.blockType === "timeline"
    || anchor.visualTemplateId === "big_number"
    || anchor.visualTemplateId === "metric_chart"
  ) {
    return { motionProfile: "glide", minDuration: 1.15, maxDuration: 1.85, scaleFrom: 1.02 };
  }

  if (
    anchor.blockType === "comparison"
    || anchor.blockType === "myth_vs_truth"
    || anchor.blockType === "warning"
    || anchor.blockType === "list"
    || anchor.visualTemplateId === "checklist"
    || anchor.visualTemplateId === "concept_map"
    || anchor.visualTemplateId === "myth_strike"
  ) {
    return { motionProfile: "sweep", minDuration: 1.05, maxDuration: 1.55, scaleFrom: 1.015 };
  }

  return {
    motionProfile: "steady",
    minDuration: anchor.source === "caption" ? 0.8 : 1,
    maxDuration: 1.35,
    scaleFrom: anchor.source === "semantic_block" || anchor.visualTemplateId ? 1.02 : 1
  };
}

function layoutBiasFor(layout?: BrowserFrameVisualBeat["layout"], blockType?: SemanticBlock["type"]) {
  if (layout === "left") return { xFrom: 0.02, xTo: -0.03 };
  if (layout === "right") return { xFrom: -0.02, xTo: 0.03 };
  if (layout === "top") return { xFrom: 0, xTo: 0 };
  if (blockType === "comparison" || blockType === "myth_vs_truth") return { xFrom: -0.015, xTo: 0.02 };
  if (blockType === "list") return { xFrom: 0.015, xTo: -0.02 };
  return { xFrom: -0.01, xTo: 0.01 };
}

function moveWindowForAnchor(anchor: CameraAnchor, duration: number, spec: CameraMotionSpec) {
  const rawLength = Math.max(0, anchor.end - anchor.start);
  const cappedLength = spec.maxDuration ? Math.min(rawLength, spec.maxDuration) : rawLength;
  const finalLength = roundTime(Math.max(spec.minDuration ?? 0.3, cappedLength));
  return {
    start: roundTime(anchor.start),
    end: roundTime(Math.min(duration, anchor.start + finalLength))
  };
}

function compressAdjacentMoves(moves: BrowserFrameCameraMove[]) {
  const compressed: BrowserFrameCameraMove[] = [];

  for (const move of moves) {
    const previous = compressed.at(-1);
    if (
      previous
      && Math.abs(previous.end - move.start) <= 0.08
      && Math.abs(previous.scaleTo - move.scaleTo) <= 0.02
      && Math.abs(previous.xTo - move.xTo) <= 0.02
      && Math.abs(previous.yTo - move.yTo) <= 0.02
    ) {
      previous.end = move.end;
      previous.scaleTo = move.scaleTo;
      previous.xTo = move.xTo;
      previous.yTo = move.yTo;
      continue;
    }

    compressed.push({ ...move });
  }

  return compressed;
}

function visualText(beat: BrowserFrameVisualBeat) {
  const payload = beat.payload;
  if (typeof payload.text === "string") return payload.text;
  if (typeof payload.title === "string") return payload.title;
  if (typeof payload.value === "string") return `${payload.value} ${typeof payload.label === "string" ? payload.label : ""}`.trim();
  return beat.templateId;
}

function overlapSeconds(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

function roundTime(value: number) {
  return Math.round(value * 1000) / 1000;
}
