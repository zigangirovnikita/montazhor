"use client";

import type { CSSProperties } from "react";
import type { BrowserFrameVisualBeat } from "@/server/render/browserFrameRendererPlan";

export function LiveVisualOverlay({
  beat
}: {
  beat: BrowserFrameVisualBeat | null;
}) {
  if (!beat) return null;

  const layoutStyle = layoutStyleFor(beat.layout);
  const cardStyle = cardStyleFor(beat.templateId);

  return (
    <div
      className={`live-visual-overlay beat-${beat.templateId}`}
      style={{
        position: "absolute",
        zIndex: 1,
        display: "grid",
        gap: "0.55rem",
        padding: "0.9rem 1rem",
        borderRadius: "1.2rem",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 24px 48px rgba(0,0,0,0.22)",
        backdropFilter: "blur(16px)",
        background: "rgba(9, 13, 20, 0.58)",
        color: "#fff8ef",
        width: "min(42%, 20rem)",
        ...layoutStyle,
        ...cardStyle
      }}
    >
      {renderBeatContent(beat)}
    </div>
  );
}

function renderBeatContent(beat: BrowserFrameVisualBeat) {
  const payload = beat.payload;

  if (beat.templateId === "big_number") {
    return (
      <>
        <strong style={{ fontSize: "clamp(2rem, 4vw, 3.4rem)", lineHeight: 0.95 }}>{stringValue(payload.value)}</strong>
        <span style={{ fontSize: "0.95rem", opacity: 0.88 }}>{stringValue(payload.label)}</span>
      </>
    );
  }

  if (beat.templateId === "metric_chart") {
    const values = arrayValues(payload.values);
    const rows = tableRows(payload.rows);
    if (payload.mode === "table" && rows.length) {
      return (
        <>
          <span style={{ fontSize: "0.72rem", letterSpacing: "0.14em", opacity: 0.75 }}>{stringValue(payload.title)}</span>
          <div style={{ display: "grid", gap: "0.35rem" }}>
            {rows.map((row, index) => (
              <div
                key={`${beat.id}-row-${index}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "0.7rem",
                  alignItems: "center",
                  padding: "0.3rem 0",
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
        <span style={{ fontSize: "0.72rem", letterSpacing: "0.14em", opacity: 0.75 }}>{stringValue(payload.title)}</span>
        <div style={{ display: "grid", gap: "0.4rem" }}>
          {values.map((value, index) => (
            <div key={`${beat.id}-metric-${index}`} style={{ display: "grid", gap: "0.18rem" }}>
              <strong style={{ fontSize: "1.1rem" }}>{value}</strong>
              <div style={{ height: "0.42rem", borderRadius: "999px", background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
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
          <span style={{ fontSize: "0.78rem", letterSpacing: "0.12em", opacity: 0.78 }}>{stringValue(payload.title)}</span>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {arrayValues(payload.items).map((item, index) => {
              const [lead, ...rest] = item.split(" ");
              return (
                <div key={`${beat.id}-timeline-${index}`} style={{ display: "grid", gridTemplateColumns: "3rem 1fr", gap: "0.55rem", alignItems: "start" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      justifyContent: "center",
                      padding: "0.2rem 0.35rem",
                      borderRadius: "999px",
                      background: "rgba(115, 200, 255, 0.18)",
                      color: "#9fe5ff",
                      fontSize: "0.82rem",
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
        <span style={{ fontSize: "0.78rem", letterSpacing: "0.12em", opacity: 0.78 }}>{stringValue(payload.title)}</span>
        <div style={{ display: "grid", gap: "0.42rem" }}>
          {arrayValues(payload.items).map((item, index) => (
            <div key={`${beat.id}-item-${index}`} style={{ display: "grid", gridTemplateColumns: "1rem 1fr", gap: "0.45rem", alignItems: "start" }}>
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
        <span style={{ fontSize: "0.72rem", letterSpacing: "0.14em", color: "#ffb284" }}>{stringValue(payload.eyebrow)}</span>
        <span style={{ textDecoration: "line-through", opacity: 0.72 }}>{stringValue(payload.falseText)}</span>
        <strong style={{ color: "#c4ff89" }}>{stringValue(payload.trueText)}</strong>
      </>
    );
  }

  if (beat.templateId === "cta_plate") {
    return (
      <>
        <span style={{ fontSize: "0.72rem", letterSpacing: "0.14em", color: "#ffe24f" }}>{stringValue(payload.label)}</span>
        <strong style={{ fontSize: "1.3rem", lineHeight: 1.05 }}>{stringValue(payload.text)}</strong>
      </>
    );
  }

  if (payload.mode === "definition") {
    return (
      <>
        <span style={{ fontSize: "0.72rem", letterSpacing: "0.14em", opacity: 0.78 }}>{stringValue(payload.eyebrow)}</span>
        <strong style={{ fontSize: "1.2rem", lineHeight: 1.05 }}>{stringValue(payload.title || payload.center)}</strong>
        <div style={{ padding: "0.6rem 0.7rem", borderRadius: "0.95rem", background: "rgba(255,255,255,0.06)", fontSize: "0.92rem", lineHeight: 1.3 }}>
          {stringValue(payload.body || payload.caption)}
        </div>
      </>
    );
  }

  if (payload.mode === "mindmap") {
    return (
      <>
        <span style={{ fontSize: "0.72rem", letterSpacing: "0.14em", opacity: 0.78 }}>{stringValue(payload.eyebrow)}</span>
        <strong style={{ fontSize: "1.15rem", lineHeight: 1.05 }}>{stringValue(payload.center || payload.title)}</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
          {arrayValues(payload.branches).map((branch, index) => (
            <span
              key={`${beat.id}-branch-${index}`}
              style={{
                padding: "0.35rem 0.6rem",
                borderRadius: "999px",
                background: "rgba(115, 200, 255, 0.14)",
                border: "1px solid rgba(115, 200, 255, 0.18)",
                fontSize: "0.84rem"
              }}
            >
              {branch}
            </span>
          ))}
        </div>
        {payload.caption ? <span style={{ fontSize: "0.82rem", opacity: 0.74 }}>{stringValue(payload.caption)}</span> : null}
      </>
    );
  }

  return (
    <>
      <span style={{ fontSize: "0.72rem", letterSpacing: "0.14em", opacity: 0.78 }}>{stringValue(payload.eyebrow)}</span>
      <strong style={{ fontSize: "1.15rem", lineHeight: 1.05 }}>{stringValue(payload.center || payload.title)}</strong>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.92rem" }}>
        <span>{stringValue(payload.left)}</span>
        <span>{stringValue(payload.right)}</span>
      </div>
      {payload.caption ? <span style={{ fontSize: "0.82rem", opacity: 0.74 }}>{stringValue(payload.caption)}</span> : null}
    </>
  );
}

function layoutStyleFor(layout: BrowserFrameVisualBeat["layout"]): CSSProperties {
  if (layout === "left") return { left: "6%", top: "11%" };
  if (layout === "right") return { right: "6%", top: "11%" };
  if (layout === "top") return { left: "50%", top: "8%", transform: "translateX(-50%)", width: "min(58%, 26rem)" };
  return { left: "50%", top: "13%", transform: "translateX(-50%)", width: "min(56%, 24rem)" };
}

function cardStyleFor(templateId: BrowserFrameVisualBeat["templateId"]): CSSProperties {
  if (templateId === "cta_plate") return { background: "rgba(28, 18, 10, 0.7)" };
  if (templateId === "big_number" || templateId === "metric_chart") return { background: "rgba(8, 18, 34, 0.72)" };
  return {};
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
