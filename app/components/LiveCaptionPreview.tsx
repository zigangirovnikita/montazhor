"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CaptionPosition, CaptionSize, StyleDraftOptions } from "@/app/components/PresentationConfigurator";
import type { BrowserFrameRenderPlan } from "@/server/render/browserFrameRendererPlan";

export type PreviewSeekRequest = {
  id: number;
  time: number;
};

export function LiveCaptionPreview({
  videoUrl,
  plan,
  stylePreset,
  styleOptions,
  showSubtitles = true,
  currentTime,
  onTimeChange,
  onPlayingChange,
  seekRequest
}: {
  videoUrl: string;
  plan: BrowserFrameRenderPlan | null;
  stylePreset: string;
  styleOptions: StyleDraftOptions;
  showSubtitles?: boolean;
  currentTime?: number;
  onTimeChange?: (time: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  seekRequest?: PreviewSeekRequest | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [internalCurrentTime, setInternalCurrentTime] = useState(0);
  const resolvedCurrentTime = currentTime ?? internalCurrentTime;
  const activeCaption = useMemo(
    () => plan ? resolveCaptionAtTime(plan, resolvedCurrentTime) : null,
    [plan, resolvedCurrentTime]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let frame = 0;
    const update = () => {
      syncCurrentTime(video.currentTime || 0, onTimeChange, setInternalCurrentTime);
      if (!video.paused && !video.ended) frame = window.requestAnimationFrame(update);
    };

    const handleTimeUpdate = () => syncCurrentTime(video.currentTime || 0, onTimeChange, setInternalCurrentTime);
    const handlePlay = () => {
      onPlayingChange?.(true);
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };
    const handlePause = () => {
      onPlayingChange?.(false);
      window.cancelAnimationFrame(frame);
      syncCurrentTime(video.currentTime || 0, onTimeChange, setInternalCurrentTime);
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
  }, [onPlayingChange, onTimeChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !seekRequest) return;

    const applySeek = () => {
      if (!video) return;
      video.currentTime = Math.max(0, seekRequest.time);
      syncCurrentTime(video.currentTime || 0, onTimeChange, setInternalCurrentTime);
    };

    if (video.readyState >= 1) {
      applySeek();
      return;
    }

    video.addEventListener("loadedmetadata", applySeek, { once: true });
    return () => video.removeEventListener("loadedmetadata", applySeek);
  }, [seekRequest, onTimeChange]);

  const skin = captionSkin(stylePreset, styleOptions);

  if (!plan || !showSubtitles) {
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
            fontFamily: skin.fontFamily,
            alignItems: alignItemsForPosition(styleOptions.captionPosition),
            zIndex: 2
          }}
        >
          <div
            className={`live-caption-box backdrop-${skin.backdrop}`}
            style={{
              color: skin.textColor,
              fontSize: fontSizeForCaptionSize(styleOptions.captionSize, skin.fontSize),
              fontWeight: skin.fontWeight,
              textTransform: skin.textTransform
            }}
          >
            {activeCaption ? renderCaptionLines(activeCaption, resolvedCurrentTime, styleOptions, skin) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function syncCurrentTime(
  value: number,
  onTimeChange: ((time: number) => void) | undefined,
  setInternalCurrentTime: (value: number) => void
) {
  setInternalCurrentTime(value);
  onTimeChange?.(value);
}

function renderCaptionLines(
  caption: BrowserFrameRenderPlan["captions"][number],
  currentTime: number,
  styleOptions: StyleDraftOptions,
  skin: ReturnType<typeof captionSkin>
) {
  const subtitleStyle = styleOptions.subtitleStyle;
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
              emphasized ? `is-${skin.highlightMode}` : ""
            ].filter(Boolean).join(" ")}
            style={emphasized ? emphasizedWordStyle(skin) : undefined}
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
  const tolerance = 0.08;
  return plan.captions.find((caption) => currentTime >= caption.start - tolerance && currentTime <= caption.end + tolerance) ?? null;
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}%$€₽-]+/gu, "");
}

function captionSkin(stylePreset: string, styleOptions: StyleDraftOptions) {
  const fontFamily = fontFamilyFor(styleOptions.subtitleFont);
  const accentFontFamily = fontFamilyFor(styleOptions.accentFont ?? styleOptions.subtitleFont);
  const backdrop = styleOptions.subtitleBackdrop;

  if (stylePreset === "premium_calm" || stylePreset === "course_glass") {
    return {
      variant: "premium",
      fontFamily,
      accentFontFamily,
      backdrop,
      fontSize: "clamp(1.8rem, 3.8vw, 3.5rem)",
      fontWeight: 700,
      textColor: styleOptions.subtitleColor ?? "#fff7e7",
      accentColor: styleOptions.accentColor ?? "#d7b47f",
      textTransform: styleOptions.textCase === "upper" ? "uppercase" as const : "none" as const,
      highlightMode: "text" as const
    };
  }

  if (stylePreset === "dynamic_viral" || stylePreset === "viral_kinetic") {
    return {
      variant: "viral",
      fontFamily,
      accentFontFamily,
      backdrop,
      fontSize: "clamp(2rem, 4.4vw, 4.2rem)",
      fontWeight: 900,
      textColor: styleOptions.subtitleColor ?? "#ffffff",
      accentColor: styleOptions.accentColor ?? "#ffe24f",
      textTransform: styleOptions.textCase === "sentence" ? "none" as const : "uppercase" as const,
      highlightMode: styleOptions.subtitleStyle === "marker" ? "marker" as const : "fill" as const
    };
  }

  return {
    variant: "clean",
    fontFamily,
    accentFontFamily,
    backdrop,
    fontSize: "clamp(1.9rem, 4vw, 3.8rem)",
    fontWeight: 800,
    textColor: styleOptions.subtitleColor ?? "#ffffff",
    accentColor: styleOptions.accentColor ?? "#8fd4ff",
    textTransform: styleOptions.textCase === "upper" ? "uppercase" as const : "none" as const,
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

function emphasizedWordStyle(skin: ReturnType<typeof captionSkin>) {
  return {
    fontFamily: skin.accentFontFamily,
    ["--accent-color" as string]: skin.accentColor
  };
}

function alignItemsForPosition(position: CaptionPosition | undefined) {
  if (position === "middle") return "center";
  return "flex-end";
}

function fontSizeForCaptionSize(size: CaptionSize | undefined, fallback: string) {
  if (size === "sm") return "clamp(1.55rem, 3vw, 2.8rem)";
  if (size === "lg") return "clamp(2.2rem, 4.8vw, 4.4rem)";
  return fallback;
}
