"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { StyleDraftOptions } from "@/app/components/PresentationConfigurator";
import type { BrowserFrameRenderPlan } from "@/server/render/browserFrameRendererPlan";

export function LiveCaptionPreview({
  videoUrl,
  plan,
  stylePreset,
  styleOptions
}: {
  videoUrl: string;
  plan: BrowserFrameRenderPlan | null;
  stylePreset: string;
  styleOptions: StyleDraftOptions;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const activeCaption = useMemo(
    () => plan ? resolveCaptionAtTime(plan, currentTime) : null,
    [plan, currentTime]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let frame = 0;
    const update = () => {
      setCurrentTime(video.currentTime || 0);
      if (!video.paused && !video.ended) frame = window.requestAnimationFrame(update);
    };

    const handleTimeUpdate = () => setCurrentTime(video.currentTime || 0);
    const handlePlay = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };
    const handlePause = () => {
      window.cancelAnimationFrame(frame);
      setCurrentTime(video.currentTime || 0);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("seeked", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handlePause);

    return () => {
      window.cancelAnimationFrame(frame);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("seeked", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handlePause);
    };
  }, []);

  const skin = captionSkin(stylePreset, styleOptions);

  if (!plan) {
    return (
      <div className="compare-player">
        <video ref={videoRef} src={videoUrl} controls playsInline />
      </div>
    );
  }

  return (
    <div className="compare-player live-caption-preview">
      <div className="live-caption-stage" style={{ aspectRatio: `${plan.width} / ${plan.height}` }}>
        <video ref={videoRef} src={videoUrl} controls playsInline />
        <div
          className={`live-caption-shell live-${skin.variant}`}
          style={{
            left: `${(plan.diagnostics.captionSafeArea.x / plan.width) * 100}%`,
            top: `${(plan.diagnostics.captionSafeArea.y / plan.height) * 100}%`,
            width: `${(plan.diagnostics.captionSafeArea.width / plan.width) * 100}%`,
            height: `${(plan.diagnostics.captionSafeArea.height / plan.height) * 100}%`,
            fontFamily: skin.fontFamily
          }}
        >
          <div
            className={`live-caption-box backdrop-${skin.backdrop}`}
            style={{
              color: skin.textColor,
              fontSize: skin.fontSize,
              fontWeight: skin.fontWeight,
              textTransform: skin.textTransform
            }}
          >
            {activeCaption ? renderCaptionLines(activeCaption, currentTime, styleOptions.subtitleStyle, skin.highlightMode) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderCaptionLines(
  caption: BrowserFrameRenderPlan["captions"][number],
  currentTime: number,
  subtitleStyle: StyleDraftOptions["subtitleStyle"],
  highlightMode: "fill" | "text" | "marker"
) {
  const activeWordIndex = caption.words.findIndex((word) => currentTime >= word.start && currentTime <= word.end);
  let sequentialIndex = 0;

  return caption.lines.map((line, lineIndex) => (
    <span className="live-caption-line" key={`${caption.id}-line-${lineIndex}`}>
      {line.split(/\s+/).filter(Boolean).map((token, tokenIndex, tokens) => {
        const wordIndex = sequentialIndex;
        sequentialIndex += 1;
        const active = subtitleStyle !== "clean" && wordIndex === activeWordIndex;
        const emphasized = active || (subtitleStyle !== "clean" && caption.highlightedWords.includes(normalizeToken(token)));
        return (
          <span
            className={[
              "live-caption-word",
              active ? "is-active" : "",
              emphasized ? `is-${highlightMode}` : ""
            ].filter(Boolean).join(" ")}
            key={`${caption.id}-${lineIndex}-${wordIndex}-${token}`}
          >
            {token}
            {tokenIndex < tokens.length - 1 ? " " : ""}
          </span>
        );
      })}
    </span>
  ));
}

function resolveCaptionAtTime(plan: BrowserFrameRenderPlan, currentTime: number) {
  return plan.captions.find((caption) => currentTime >= caption.start && currentTime <= caption.end) ?? null;
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}%$€₽-]+/gu, "");
}

function captionSkin(stylePreset: string, styleOptions: StyleDraftOptions) {
  const fontFamily = fontFamilyFor(styleOptions.subtitleFont);
  const backdrop = styleOptions.subtitleBackdrop;

  if (stylePreset === "premium_calm") {
    return {
      variant: "premium",
      fontFamily,
      backdrop,
      fontSize: "clamp(1.8rem, 3.8vw, 3.5rem)",
      fontWeight: 700,
      textColor: "#fff7e7",
      textTransform: "none" as const,
      highlightMode: "text" as const
    };
  }

  if (stylePreset === "dynamic_viral") {
    return {
      variant: "viral",
      fontFamily,
      backdrop,
      fontSize: "clamp(2rem, 4.4vw, 4.2rem)",
      fontWeight: 900,
      textColor: "#ffffff",
      textTransform: "uppercase" as const,
      highlightMode: styleOptions.subtitleStyle === "marker" ? "marker" as const : "fill" as const
    };
  }

  return {
    variant: "clean",
    fontFamily,
    backdrop,
    fontSize: "clamp(1.9rem, 4vw, 3.8rem)",
    fontWeight: 800,
    textColor: "#ffffff",
    textTransform: "none" as const,
    highlightMode: styleOptions.subtitleStyle === "marker" ? "marker" as const : "text" as const
  };
}

function fontFamilyFor(font: StyleDraftOptions["subtitleFont"]) {
  if (font === "onest") return '"Onest", system-ui, sans-serif';
  if (font === "unbounded") return '"Unbounded", system-ui, sans-serif';
  if (font === "montserrat") return '"Montserrat", system-ui, sans-serif';
  if (font === "golos") return '"Golos Text", system-ui, sans-serif';
  return '"Manrope", system-ui, sans-serif';
}
