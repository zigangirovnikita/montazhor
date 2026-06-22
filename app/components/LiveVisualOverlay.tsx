"use client";

import type { CSSProperties } from "react";
import type { BrowserFrameVisualBeat } from "@/server/render/browserFrameRendererPlan";
import { scaleCssPxString, scalePreviewPx } from "@/lib/livePreviewSizing";

export function LiveVisualOverlay({
  beat,
  previewScale = 1,
  stageWidth
}: {
  beat: BrowserFrameVisualBeat | null;
  previewScale?: number;
  stageWidth?: number;
}) {
  if (!beat) return null;

  const px = (value: number, options?: { min?: number; max?: number }) =>
    `${scalePreviewPx(value, previewScale, options)}px`;
  const cardWidth = resolveCardWidth(beat.layout, previewScale, stageWidth);
  const layoutStyle = layoutStyleFor(beat.layout, cardWidth);
  const cardStyle = cardStyleFor(beat.templateId);

  return (
    <div
      className={`live-visual-overlay beat-${beat.templateId}`}
      style={{
        position: "absolute",
        zIndex: 1,
        display: "grid",
        gap: px(10, { min: 4 }),
        padding: `${px(18, { min: 8 })} ${px(20, { min: 10 })}`,
        borderRadius: px(22, { min: 10 }),
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: scaleCssPxString("0 24px 48px rgba(0,0,0,0.22)", previewScale),
        backdropFilter: `blur(${px(16, { min: 8 })})`,
        background: "rgba(9, 13, 20, 0.58)",
        color: "#fff8ef",
        width: `${cardWidth}px`,
        maxWidth: "58%",
        ...layoutStyle,
        ...cardStyle
      }}
    >
      {renderBeatContent(beat, previewScale)}
    </div>
  );
}

function renderBeatContent(beat: BrowserFrameVisualBeat, previewScale: number) {
  const payload = beat.payload;
  const px = (value: number, options?: { min?: number; max?: number }) =>
    `${scalePreviewPx(value, previewScale, options)}px`;

  if (beat.templateId === "big_number") {
    return (
      <>
        <strong style={{ fontSize: px(68, { min: 18 }), lineHeight: 0.95 }}>{stringValue(payload.value)}</strong>
        <span style={{ fontSize: px(16, { min: 10 }), opacity: 0.88 }}>{stringValue(payload.label)}</span>
      </>
    );
  }

  if (beat.templateId === "metric_chart") {
    const values = arrayValues(payload.values);
    const rows = tableRows(payload.rows);
    if (payload.mode === "table" && rows.length) {
      return (
        <>
          <span style={{ fontSize: px(14, { min: 9 }), letterSpacing: "0.14em", opacity: 0.75 }}>{stringValue(payload.title)}</span>
          <div style={{ display: "grid", gap: px(8, { min: 4 }) }}>
            {rows.map((row, index) => (
              <div
                key={`${beat.id}-row-${index}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: px(12, { min: 6 }),
                  alignItems: "center",
                  padding: `${px(8, { min: 4 })} 0`,
                  borderBottom: index === rows.length - 1 ? "none" : "1px solid rgba(255,255,255,0.08)"
                }}
              >
                <span style={{ opacity: 0.82 }}>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </>
      );
    }

    return (
      <>
        <span style={{ fontSize: px(14, { min: 9 }), letterSpacing: "0.14em", opacity: 0.75 }}>{stringValue(payload.title)}</span>
        <div style={{ display: "grid", gap: px(10, { min: 5 }) }}>
          {values.map((value, index) => (
            <div key={`${beat.id}-metric-${index}`} style={{ display: "grid", gap: px(4, { min: 2 }) }}>
              <strong style={{ fontSize: px(18, { min: 11 }) }}>{value}</strong>
              <div style={{ height: px(7, { min: 4 }), borderRadius: "999px", background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.max(20, 100 - index * 24)}%`,
                    height: "100%",
                    borderRadius: "999px",
                    background: "linear-gradient(90deg, #73c8ff 0%, #ffe24f 100%)"
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (beat.templateId === "checklist") {
    if (payload.mode === "timeline") {
      return (
        <>
          <span style={{ fontSize: px(14, { min: 9 }), letterSpacing: "0.12em", opacity: 0.78 }}>{stringValue(payload.title)}</span>
          <div style={{ display: "grid", gap: px(10, { min: 5 }) }}>
            {arrayValues(payload.items).map((item, index) => {
              const [lead, ...rest] = item.split(" ");
              return (
                <div key={`${beat.id}-timeline-${index}`} style={{ display: "grid", gridTemplateColumns: `${px(52, { min: 26 })} 1fr`, gap: px(8, { min: 4 }), alignItems: "start" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      justifyContent: "center",
                      padding: `${px(4, { min: 2 })} ${px(8, { min: 4 })}`,
                      borderRadius: "999px",
                      background: "rgba(115, 200, 255, 0.18)",
                      color: "#9fe5ff",
                      fontSize: px(13, { min: 9 }),
                      fontWeight: 700
                    }}
                  >
                    {lead}
                  </span>
                  <span>{rest.join(" ") || lead}</span>
                </div>
              );
            })}
          </div>
        </>
      );
    }

    return (
      <>
        <span style={{ fontSize: px(14, { min: 9 }), letterSpacing: "0.12em", opacity: 0.78 }}>{stringValue(payload.title)}</span>
        <div style={{ display: "grid", gap: px(8, { min: 4 }) }}>
          {arrayValues(payload.items).map((item, index) => (
            <div key={`${beat.id}-item-${index}`} style={{ display: "grid", gridTemplateColumns: `${px(18, { min: 10 })} 1fr`, gap: px(8, { min: 4 }), alignItems: "start" }}>
              <span style={{ color: "#9df79d" }}>✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (beat.templateId === "myth_strike") {
    return (
      <>
        <span style={{ fontSize: px(14, { min: 9 }), letterSpacing: "0.14em", color: "#ffb284" }}>{stringValue(payload.eyebrow)}</span>
        <span style={{ textDecoration: "line-through", opacity: 0.72 }}>{stringValue(payload.falseText)}</span>
        <strong style={{ color: "#c4ff89" }}>{stringValue(payload.trueText)}</strong>
      </>
    );
  }

  if (beat.templateId === "cta_plate") {
    return (
      <>
        <span style={{ fontSize: px(14, { min: 9 }), letterSpacing: "0.14em", color: "#ffe24f" }}>{stringValue(payload.label)}</span>
        <strong style={{ fontSize: px(30, { min: 14 }), lineHeight: 1.05 }}>{stringValue(payload.text)}</strong>
      </>
    );
  }

  if (payload.mode === "definition") {
    return (
      <>
        <span style={{ fontSize: px(14, { min: 9 }), letterSpacing: "0.14em", opacity: 0.78 }}>{stringValue(payload.eyebrow)}</span>
        <strong style={{ fontSize: px(26, { min: 13 }), lineHeight: 1.05 }}>{stringValue(payload.title || payload.center)}</strong>
        <div style={{ padding: `${px(12, { min: 6 })} ${px(14, { min: 7 })}`, borderRadius: px(16, { min: 8 }), background: "rgba(255,255,255,0.06)", fontSize: px(16, { min: 10 }), lineHeight: 1.3 }}>
          {stringValue(payload.body || payload.caption)}
        </div>
      </>
    );
  }

  if (payload.mode === "mindmap") {
    return (
      <>
        <span style={{ fontSize: px(14, { min: 9 }), letterSpacing: "0.14em", opacity: 0.78 }}>{stringValue(payload.eyebrow)}</span>
        <strong style={{ fontSize: px(26, { min: 13 }), lineHeight: 1.05 }}>{stringValue(payload.center || payload.title)}</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: px(8, { min: 4 }) }}>
          {arrayValues(payload.branches).map((branch, index) => (
            <span
              key={`${beat.id}-branch-${index}`}
              style={{
                padding: `${px(6, { min: 3 })} ${px(10, { min: 5 })}`,
                borderRadius: "999px",
                background: "rgba(115, 200, 255, 0.14)",
                border: "1px solid rgba(115, 200, 255, 0.18)",
                fontSize: px(14, { min: 9 })
              }}
            >
              {branch}
            </span>
          ))}
        </div>
        {payload.caption ? <span style={{ fontSize: px(16, { min: 10 }), opacity: 0.74 }}>{stringValue(payload.caption)}</span> : null}
      </>
    );
  }

  return (
    <>
      <span style={{ fontSize: px(14, { min: 9 }), letterSpacing: "0.14em", opacity: 0.78 }}>{stringValue(payload.eyebrow)}</span>
      <strong style={{ fontSize: px(26, { min: 13 }), lineHeight: 1.05 }}>{stringValue(payload.center || payload.title)}</strong>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: px(12, { min: 6 }), fontSize: px(16, { min: 10 }) }}>
        <span>{stringValue(payload.left)}</span>
        <span>{stringValue(payload.right)}</span>
      </div>
      {payload.caption ? <span style={{ fontSize: px(16, { min: 10 }), opacity: 0.74 }}>{stringValue(payload.caption)}</span> : null}
    </>
  );
}

function layoutStyleFor(layout: BrowserFrameVisualBeat["layout"], cardWidth: number): CSSProperties {
  if (layout === "left") return { left: "6%", top: "11%" };
  if (layout === "right") return { right: "6%", top: "11%" };
  if (layout === "top") return { left: "50%", top: "8%", transform: "translateX(-50%)", width: `${cardWidth}px` };
  return { left: "50%", top: "13%", transform: "translateX(-50%)", width: `${cardWidth}px` };
}

function cardStyleFor(templateId: BrowserFrameVisualBeat["templateId"]): CSSProperties {
  if (templateId === "cta_plate") return { background: "rgba(28, 18, 10, 0.7)" };
  if (templateId === "big_number" || templateId === "metric_chart") return { background: "rgba(8, 18, 34, 0.72)" };
  return {};
}

function resolveCardWidth(
  layout: BrowserFrameVisualBeat["layout"],
  previewScale: number,
  stageWidth?: number
) {
  const availableWidth = stageWidth && stageWidth > 0 ? stageWidth : 0;
  if (layout === "top") {
    const scaledMax = scalePreviewPx(420, previewScale, { min: 180 });
    return availableWidth > 0 ? Math.min(availableWidth * 0.58, scaledMax) : scaledMax;
  }

  if (layout === "center") {
    const scaledMax = scalePreviewPx(380, previewScale, { min: 170 });
    return availableWidth > 0 ? Math.min(availableWidth * 0.56, scaledMax) : scaledMax;
  }

  const scaledMax = scalePreviewPx(320, previewScale, { min: 160 });
  return availableWidth > 0 ? Math.min(availableWidth * 0.42, scaledMax) : scaledMax;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function arrayValues(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function tableRows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const label = typeof (row as { label?: unknown }).label === "string" ? (row as { label: string }).label : "";
      const val = typeof (row as { value?: unknown }).value === "string" ? (row as { value: string }).value : "";
      return label && val ? { label, value: val } : null;
    })
    .filter((row): row is { label: string; value: string } => Boolean(row));
}
