"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LiveVisualOverlay } from "@/app/components/LiveVisualOverlay";
import { buildCaptionDesign, captionBoxBackdropStyles } from "@/lib/captionDesign";
import { computeLivePreviewScale, resolvePreviewFontSize, scaleCssPxString, scalePreviewPx } from "@/lib/livePreviewSizing";
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
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [internalCurrentTime, setInternalCurrentTime] = useState(0);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
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

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return;

    const updateSize = () => {
      const rect = stage.getBoundingClientRect();
      setStageSize((prev) => (
        prev.width === rect.width && prev.height === rect.height
          ? prev
          : { width: rect.width, height: rect.height }
      ));
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [plan?.width, plan?.height]);

  const design = useMemo(
    () => buildCaptionDesign(stylePreset, styleOptions),
    [stylePreset, styleOptions]
  );
  const backdropStyles = useMemo(
    () => captionBoxBackdropStyles(design),
    [design]
  );
  const previewScale = useMemo(
    () => plan ? computeLivePreviewScale({
      frameWidth: plan.width,
      frameHeight: plan.height,
      stageWidth: stageSize.width,
      stageHeight: stageSize.height
    }) : 1,
    [plan, stageSize.height, stageSize.width]
  );
  const scaledBackdropStyles = useMemo(
    () => ({
      ...backdropStyles,
      border: scaleCssPxString(backdropStyles.border, previewScale),
      boxShadow: scaleCssPxString(backdropStyles.boxShadow, previewScale),
      backdropFilter: scaleCssPxString(backdropStyles.backdropFilter, previewScale)
    }),
    [backdropStyles, previewScale]
  );
  const previewFontSize = useMemo(
    () => plan ? resolvePreviewFontSize(design.fontSize, plan.width, previewScale) : design.fontSize,
    [design.fontSize, plan, previewScale]
  );
  const previewStrokeWidth = useMemo(
    () => scalePreviewPx(design.strokeWidth, previewScale, { min: 0, max: 6 }),
    [design.strokeWidth, previewScale]
  );
  const captionMotionStyle = useMemo(
    () => activeCaption ? captionMotionForPreview(activeCaption, resolvedCurrentTime, design.enterAnimation, previewScale) : null,
    [activeCaption, resolvedCurrentTime, design.enterAnimation, previewScale]
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
      <div ref={stageRef} className="live-caption-stage" style={{ aspectRatio: `${plan.width} / ${plan.height}` }}>
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
        <LiveVisualOverlay beat={activeVisualBeat} previewScale={previewScale} stageWidth={stageSize.width} />
        <div
          className={`live-caption-shell live-${design.variant}`}
          style={{
            left: `${(plan.diagnostics.captionSafeArea.x / plan.width) * 100}%`,
            top: `${(plan.diagnostics.captionSafeArea.y / plan.height) * 100}%`,
            width: `${(plan.diagnostics.captionSafeArea.width / plan.width) * 100}%`,
            height: `${(plan.diagnostics.captionSafeArea.height / plan.height) * 100}%`,
            fontFamily: design.fontFamily,
            alignItems: design.position === "middle" ? "center" : "flex-end",
            paddingBottom: `${scalePreviewPx(26, previewScale, { min: 12 })}px`,
            paddingTop: `${scalePreviewPx(26, previewScale, { min: 12 })}px`,
            zIndex: 2
          }}
        >
          {activeCaption ? (
            <div
              className={`live-caption-box backdrop-${design.backdrop}`}
              style={{
                color: design.textColor,
                fontSize: previewFontSize,
                fontWeight: design.fontWeight,
                textTransform: design.textTransform,
                letterSpacing: design.letterSpacing,
                WebkitTextStroke: previewStrokeWidth > 0 ? `${previewStrokeWidth}px ${design.strokeColor}` : "0 transparent",
                textShadow: scaleCssPxString(design.textShadow, previewScale),
                opacity: captionMotionStyle?.opacity,
                transform: captionMotionStyle?.transform,
                borderRadius: `${scalePreviewPx(22, previewScale, { min: 10 })}px`,
                ...scaledBackdropStyles
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
  enterAnimation: ReturnType<typeof buildCaptionDesign>["enterAnimation"],
  previewScale: number
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
    transform: `translate3d(0,${(scalePreviewPx((1 - enter) * 24, previewScale, { min: 0 })).toFixed(2)}px,0) scale(${(0.96 + enter * 0.04).toFixed(4)})`
  };
}
