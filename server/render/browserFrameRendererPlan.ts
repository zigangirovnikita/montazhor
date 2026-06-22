import { readFile } from "node:fs/promises";
import { z } from "zod";
import { buildCaptionDesignFromLegacyStyle } from "../../lib/captionDesign";

export const DEFAULT_BROWSER_POC_FPS = 20;
export const DEFAULT_BROWSER_POC_DURATION_SECONDS = 15;
export const MAX_BROWSER_RENDER_DURATION_SECONDS = 60 * 60;
export const DEFAULT_BROWSER_FRAME_STYLE = "bold-yellow" as const;

export const browserFrameCaptionStyleSchema = z.enum([
  "bold-yellow",
  "clean-white",
  "premium-minimal"
]);

const browserFrameCaptionDesignSchema = z.object({
  variant: z.enum(["clean", "viral", "premium"]),
  fontFamily: z.string().trim().min(1),
  accentFontFamily: z.string().trim().min(1),
  backdrop: z.enum(["none", "glass", "solid"]),
  textColor: z.string().trim().min(1),
  accentColor: z.string().trim().min(1),
  textTransform: z.enum(["none", "uppercase"]),
  highlightMode: z.enum(["text", "fill", "marker"]),
  fontSize: z.string().trim().min(1),
  fontWeight: z.number().int().min(100).max(900),
  letterSpacing: z.string().trim().min(1),
  strokeWidth: z.number().min(0).max(6),
  strokeColor: z.string().trim().min(1),
  textShadow: z.string().trim().min(1),
  position: z.enum(["lower", "middle"]),
  size: z.enum(["sm", "md", "lg"]),
  enterAnimation: z.enum(["slide_up", "fade", "pop"]),
  wordAnimation: z.enum(["text", "fill", "marker", "pulse"])
});

const browserFrameWordSchema = z.object({
  text: z.string().trim().min(1),
  start: z.number().min(0),
  end: z.number().min(0)
}).refine((word) => word.end > word.start, {
  message: "Caption word end must be greater than start."
});

const browserFrameCaptionSchema = z.object({
  id: z.string().trim().min(1),
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string().trim().min(1),
  lines: z.array(z.string().trim().min(1)).min(1).max(2).default([]),
  words: z.array(browserFrameWordSchema).default([]),
  highlightedWords: z.array(z.string().trim().min(1)).max(2).default([])
}).refine((caption) => caption.end > caption.start, {
  message: "Caption end must be greater than start."
});

const browserFrameVisualBeatSchema = z.object({
  id: z.string().trim().min(1),
  start: z.number().min(0),
  end: z.number().min(0),
  templateId: z.enum(["big_number", "metric_chart", "checklist", "concept_map", "cta_plate", "myth_strike"]),
  layout: z.enum(["left", "right", "center", "top"]),
  payload: z.record(z.string(), z.any()),
  priority: z.number().int().min(1).max(3).default(1)
}).refine((beat) => beat.end > beat.start, {
  message: "Visual beat end must be greater than start."
});

const cameraValueSchema = z.number().min(-0.5).max(0.5);

const browserFrameCameraMoveSchema = z.object({
  id: z.string().trim().min(1),
  start: z.number().min(0),
  end: z.number().min(0),
  motionProfile: z.enum(["steady", "glide", "quick_push", "late_punch", "sweep"]).default("steady"),
  scaleFrom: z.number().min(1).max(1.5),
  scaleTo: z.number().min(1).max(1.5),
  xFrom: cameraValueSchema.default(0),
  xTo: cameraValueSchema.default(0),
  yFrom: cameraValueSchema.default(0),
  yTo: cameraValueSchema.default(0)
}).refine((move) => move.end > move.start, {
  message: "Camera move end must be greater than start."
});

const browserFrameDiagnosticsSchema = z.object({
  sourceVideo: z.object({
    width: z.number().int().min(1),
    height: z.number().int().min(1),
    duration: z.number().positive()
  }),
  output: z.object({
    width: z.number().int().min(1),
    height: z.number().int().min(1),
    fps: z.number().int().min(1)
  }),
  captionSource: z.enum([
    "transcript_edl_clean_time",
    "subtitles_draft_fallback",
    "demo"
  ]),
  edlApplied: z.boolean(),
  subtitlesDraftUsed: z.boolean(),
  cameraMovesEnabled: z.boolean(),
  warnings: z.array(z.string()).default([]),
  activeVideoBox: z.object({
    detected: z.boolean(),
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    width: z.number().int().min(1),
    height: z.number().int().min(1),
    source: z.enum(["frame_black_bar_detection", "full_frame_fallback"])
  }).optional(),
  captionSafeArea: z.object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    width: z.number().int().min(1),
    height: z.number().int().min(1),
    marginX: z.number().int().min(0),
    marginBottom: z.number().int().min(0)
  }).optional()
});

export const browserFrameRenderPlanSchema = z.object({
  fps: z.number().int().min(1).max(DEFAULT_BROWSER_POC_FPS).default(DEFAULT_BROWSER_POC_FPS),
  width: z.number().int().min(320).max(2160),
  height: z.number().int().min(320).max(3840),
  duration: z.number().positive().max(MAX_BROWSER_RENDER_DURATION_SECONDS),
  captionStyle: browserFrameCaptionStyleSchema.default(DEFAULT_BROWSER_FRAME_STYLE),
  captionDesign: browserFrameCaptionDesignSchema.optional(),
  captions: z.array(browserFrameCaptionSchema).default([]),
  visualBeats: z.array(browserFrameVisualBeatSchema).default([]),
  cameraMoves: z.array(browserFrameCameraMoveSchema).default([]),
  diagnostics: browserFrameDiagnosticsSchema
}).transform((plan) => ({
  ...plan,
  captionDesign: plan.captionDesign ?? buildCaptionDesignFromLegacyStyle(plan.captionStyle),
  diagnostics: {
    ...plan.diagnostics,
    activeVideoBox: plan.diagnostics.activeVideoBox ?? {
      detected: false,
      x: 0,
      y: 0,
      width: plan.width,
      height: plan.height,
      source: "full_frame_fallback" as const
    },
    captionSafeArea: plan.diagnostics.captionSafeArea ?? buildDefaultCaptionSafeArea(plan.width, plan.height)
  }
})).superRefine((plan, ctx) => {
  for (const [captionIndex, caption] of plan.captions.entries()) {
    if (caption.start > plan.duration || caption.end > plan.duration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["captions", captionIndex],
        message: "Caption must stay within plan duration."
      });
    }

    const joinedLines = caption.lines.join(" ").replace(/\s+/g, " ").trim();
    const joinedText = caption.text.replace(/\s+/g, " ").trim();
    if (caption.lines.length && joinedLines !== joinedText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["captions", captionIndex, "lines"],
        message: "Caption lines must match caption text."
      });
    }

    for (const [wordIndex, word] of caption.words.entries()) {
      if (word.start < caption.start || word.end > caption.end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["captions", captionIndex, "words", wordIndex],
          message: "Caption words must stay within caption bounds."
        });
      }
    }
  }

  for (const [moveIndex, move] of plan.cameraMoves.entries()) {
    if (move.start > plan.duration || move.end > plan.duration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cameraMoves", moveIndex],
        message: "Camera move must stay within plan duration."
      });
    }
  }

  for (const [beatIndex, beat] of plan.visualBeats.entries()) {
    if (beat.start > plan.duration || beat.end > plan.duration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["visualBeats", beatIndex],
        message: "Visual beat must stay within plan duration."
      });
    }
  }

  if (
    plan.diagnostics.activeVideoBox.x + plan.diagnostics.activeVideoBox.width > plan.width
    || plan.diagnostics.activeVideoBox.y + plan.diagnostics.activeVideoBox.height > plan.height
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["diagnostics", "activeVideoBox"],
      message: "Active video box must stay within the frame."
    });
  }

  if (
    plan.diagnostics.captionSafeArea.x + plan.diagnostics.captionSafeArea.width > plan.width
    || plan.diagnostics.captionSafeArea.y + plan.diagnostics.captionSafeArea.height > plan.height
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["diagnostics", "captionSafeArea"],
      message: "Caption safe area must stay within the frame."
    });
  }
});

export type BrowserFrameCaptionStyle = z.infer<typeof browserFrameCaptionStyleSchema>;
export type BrowserFrameCaptionDesign = z.infer<typeof browserFrameCaptionDesignSchema>;
export type BrowserFrameWord = z.infer<typeof browserFrameWordSchema>;
export type BrowserFrameCaption = z.infer<typeof browserFrameCaptionSchema>;
export type BrowserFrameVisualBeat = z.infer<typeof browserFrameVisualBeatSchema>;
export type BrowserFrameCameraMove = z.infer<typeof browserFrameCameraMoveSchema>;
export type BrowserFrameDiagnostics = z.infer<typeof browserFrameDiagnosticsSchema>;
export type BrowserFrameRenderPlan = z.infer<typeof browserFrameRenderPlanSchema>;

export async function readBrowserFrameRenderPlan(planPath: string) {
  const raw = await readFile(planPath, "utf8");
  return parseBrowserFrameRenderPlan(JSON.parse(raw));
}

export function parseBrowserFrameRenderPlan(input: unknown) {
  return browserFrameRenderPlanSchema.parse(input);
}

export function buildDemoBrowserFrameRenderPlan(input: {
  duration: number;
  width: number;
  height: number;
  fps?: number;
  captionStyle?: BrowserFrameCaptionStyle;
}) {
  const duration = Math.min(input.duration, 12);
  const fps = Math.min(input.fps ?? DEFAULT_BROWSER_POC_FPS, DEFAULT_BROWSER_POC_FPS);
  const captions = [
    "Это browser captions renderer для Montazhor",
    "Текст живет в HTML а фон идет из clean mp4",
    "Кадры собираются Puppeteer и финал склеивает FFmpeg"
  ];
  const segmentDuration = duration / captions.length;

  return parseBrowserFrameRenderPlan({
    fps,
    width: input.width,
    height: input.height,
    duration,
    captionStyle: input.captionStyle ?? DEFAULT_BROWSER_FRAME_STYLE,
    captionDesign: buildCaptionDesignFromLegacyStyle(input.captionStyle ?? DEFAULT_BROWSER_FRAME_STYLE),
    captions: captions.map((text, index) =>
      buildDemoCaption({
        id: `caption-${index + 1}`,
        text,
        start: roundTime(segmentDuration * index),
        end: roundTime(index === captions.length - 1 ? duration : segmentDuration * (index + 1))
      })
    ),
    visualBeats: [],
    cameraMoves: [
      {
        id: "camera-main",
        start: 0,
        end: duration,
        scaleFrom: 1,
        scaleTo: 1.08,
        xFrom: 0,
        xTo: 0.03,
        yFrom: 0,
        yTo: -0.02
      }
    ],
    diagnostics: {
      sourceVideo: {
        width: input.width,
        height: input.height,
        duration
      },
      output: {
        width: input.width,
        height: input.height,
        fps
      },
      captionSource: "demo",
      edlApplied: false,
      subtitlesDraftUsed: false,
      cameraMovesEnabled: true,
      warnings: [],
      activeVideoBox: {
        detected: false,
        x: 0,
        y: 0,
        width: input.width,
        height: input.height,
        source: "full_frame_fallback"
      },
      captionSafeArea: buildDefaultCaptionSafeArea(input.width, input.height)
    }
  });
}

function buildDemoCaption(input: {
  id: string;
  text: string;
  start: number;
  end: number;
}): BrowserFrameCaption {
  const tokens = input.text.split(/\s+/).filter(Boolean);
  const tokenDuration = (input.end - input.start) / Math.max(tokens.length, 1);

  return {
    id: input.id,
    text: input.text,
    lines: [input.text],
    highlightedWords: [],
    start: input.start,
    end: input.end,
    words: tokens.map((text, index) => {
      const start = roundTime(input.start + tokenDuration * index);
      const end = roundTime(index === tokens.length - 1 ? input.end : input.start + tokenDuration * (index + 1));
      return { text, start, end };
    })
  };
}

function roundTime(value: number) {
  return Math.round(value * 1000) / 1000;
}

function buildDefaultCaptionSafeArea(width: number, height: number) {
  const marginX = Math.max(36, Math.min(72, Math.round(width * 0.045)));
  const marginBottom = Math.max(96, Math.min(140, Math.round(height * 0.11)));
  return {
    x: marginX,
    y: 0,
    width: Math.max(1, width - marginX * 2),
    height: Math.max(1, height - marginBottom),
    marginX,
    marginBottom
  };
}
