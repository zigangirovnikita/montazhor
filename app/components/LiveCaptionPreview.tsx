"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LiveVisualOverlay } from "@/app/components/LiveVisualOverlay";
import { buildCaptionDesign, captionBoxBackdropStyles } from "@/lib/captionDesign";
import type { StyleDraftOptions } from "@/app/components/PresentationConfigurator";
import { createPreviewTimeReporter } from "@/app/components/previewPlaybackSync";
import type { BrowserFrameRenderPlan } from "@/server/render/browserFrameRendererPlan";
import { resolveCameraStateAtTime, resolveVisualBeatAtTime } from "@/server/render/browserFrameRendererTiming";

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
  const resolvedCurrentTime = internalCurrentTime || currentTime || 0;
  const timedCaptionStageActive = Boolean(plan && showSubtitles);
  const activeCaption = useMemo(
    () => plan ? resolveCaptionAtTime(plan, resolvedCurrentTime) : null,
    [plan, resolvedCurrentTime]
  );
  const activeCamera = useMemo(
    () => plan ? resolveCameraStateAtTime(plan.cameraMoves, resolvedCurrentTime) : null,
    [plan, resolvedCurrentTime]
  );
  const activeVisualBeat = useMemo(
    () => plan ? resolveVisualBeatAtTime(plan.visualBeats, resolvedCurrentTime) : null,
    [plan, resolvedCurrentTime]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reporter = createPreviewTimeReporter(setInternalCurrentTime, onTimeChange);

    let frame = 0;
    const update = () => {
      reporter.sync(video.currentTime || 0);
      if (!video.paused && !video.ended) frame = window.requestAnimationFrame(update);
    };

    const handleTimeUpdate = () => reporter.sync(video.currentTime || 0);
    const handlePlay = () => {
      onPlayingChange?.(true);
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };
    const handlePause = () => {
      onPlayingChange?.(false);
      window.cancelAnimationFrame(frame);
      reporter.flush(video.currentTime || 0);
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
  }, [onPlayingChange, onTimeChange, timedCaptionStageActive, videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !seekRequest) return;

    const applySeek = () => {
      if (!video) return;
      video.currentTime = Math.max(0, seekRequest.time);
      const reporter = createPreviewTimeReporter(setInternalCurrentTime, onTimeChange);
      reporter.flush(video.currentTime || 0);
    };

    if (video.readyState >= 1) {
      applySeek();
      return;
    }

    video.addEventListener("loadedmetadata", applySeek, { once: true });
    return () => video.removeEventListener("loadedmetadata", applySeek);
  }, [seekRequest, onTimeChange]);

  const design = useMemo(
    () => buildCaptionDesign(stylePreset, styleOptions),
    [stylePreset, styleOptions]
  );
  const backdropStyles = useMemo(
    () => captionBoxBackdropStyles(design),
    [design]
  );
  const captionMotionStyle = useMemo(
    () => activeCaption ? captionMotionForPreview(activeCaption, resolvedCurrentTime, design.enterAnimation) : null,
    [activeCaption, resolvedCurrentTime, design.enterAnimation]
  );

  if (!plan || !showSubtitles) {
    return (
      <div className="compare-player">
        <video ref={videoRef} src={videoUrl} controls playsInline />
      </div>
    );
  }

  if (plan.captions.length === 0) {
    return (
      <div className="compare-player">
        <video ref={videoRef} src={videoUrl} controls playsInline />
        <p className="empty-state">Нет текста для живого предпросмотра субтитров. Пересобери черновик.</p>
      </div>
    );
  }

  return (
      <div className="compare-player live-caption-preview">
      <div className="live-caption-stage" style={{ aspectRatio: `${plan.width} / ${plan.height}` }}>
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          playsInline
          style={{
            transform: activeCamera
              ? `translate3d(${(activeCamera.x * 100).toFixed(2)}%, ${(activeCamera.y * 100).toFixed(2)}%, 0) scale(${activeCamera.scale.toFixed(4)})`
              : "translate3d(0, 0, 0) scale(1)",
            transformOrigin: "center center",
            willChange: "transform"
          }}
        />
        <LiveVisualOverlay beat={activeVisualBeat} />
        <div
          className={`live-caption-shell live-${design.variant}`}
          style={{
            left: `${(plan.diagnostics.captionSafeArea.x / plan.width) * 100}%`,
            top: `${(plan.diagnostics.captionSafeArea.y / plan.height) * 100}%`,
            width: `${(plan.diagnostics.captionSafeArea.width / plan.width) * 100}%`,
            height: `${(plan.diagnostics.captionSafeArea.height / plan.height) * 100}%`,
            fontFamily: design.fontFamily,
            alignItems: design.position === "middle" ? "center" : "flex-end",
            zIndex: 2
          }}
        >
          {activeCaption ? (
            <div
              className={`live-caption-box backdrop-${design.backdrop}`}
              style={{
                color: design.textColor,
                fontSize: design.fontSize,
                fontWeight: design.fontWeight,
                textTransform: design.textTransform,
                letterSpacing: design.letterSpacing,
                WebkitTextStroke: design.strokeWidth > 0 ? `${design.strokeWidth}px ${design.strokeColor}` : "0 transparent",
                textShadow: design.textShadow,
                opacity: captionMotionStyle?.opacity,
                transform: captionMotionStyle?.transform,
                ...backdropStyles
              }}
            >
              {renderCaptionLines(activeCaption, resolvedCurrentTime, styleOptions, design)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function renderCaptionLines(
  caption: BrowserFrameRenderPlan["captions"][number],
  currentTime: number,
  styleOptions: StyleDraftOptions,
  design: ReturnType<typeof buildCaptionDesign>
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
              emphasized ? `is-${design.highlightMode}` : ""
            ].filter(Boolean).join(" ")}
            style={emphasized ? emphasizedWordStyle(design) : undefined}
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

function emphasizedWordStyle(design: ReturnType<typeof buildCaptionDesign>) {
  return {
    fontFamily: design.accentFontFamily,
    ["--accent-color" as string]: design.accentColor,
    ...(design.wordAnimation === "pulse"
      ? {
          transform: "scale(1.06)",
          textShadow: `0 0 22px ${design.accentColor}`
        }
      : null)
  };
}

function captionMotionForPreview(
  caption: BrowserFrameRenderPlan["captions"][number],
  currentTime: number,
  enterAnimation: ReturnType<typeof buildCaptionDesign>["enterAnimation"]
) {
  const duration = Math.max(0.001, caption.end - caption.start);
  const rel = Math.max(0, Math.min(1, (currentTime - caption.start) / duration));
  const enter = Math.max(0, Math.min(1, rel / 0.18));
  const exit = Math.max(0, Math.min(1, (1 - rel) / 0.14));
  const opacity = Math.min(1, enter, exit + 0.02);

  if (enterAnimation === "fade") {
    return {
      opacity,
      transform: "translate3d(0,0,0) scale(1)"
    };
  }

  if (enterAnimation === "pop") {
    return {
      opacity,
      transform: `translate3d(0,0,0) scale(${(0.92 + enter * 0.1).toFixed(4)})`
    };
  }

  return {
    opacity,
    transform: `translate3d(0,${((1 - enter) * 24).toFixed(2)}px,0) scale(${(0.96 + enter * 0.04).toFixed(4)})`
  };
}
