import { readFile } from "node:fs/promises";
import { z } from "zod";

export const DEFAULT_BROWSER_POC_FPS = 20;
export const MAX_BROWSER_POC_DURATION_SECONDS = 15;
export const DEFAULT_BROWSER_FRAME_STYLE = "bold-yellow" as const;

export const browserFrameCaptionStyleSchema = z.enum([
  "bold-yellow",
  "clean-white",
  "premium-minimal"
]);

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

const cameraValueSchema = z.number().min(-0.5).max(0.5);

const browserFrameCameraMoveSchema = z.object({
  id: z.string().trim().min(1),
  start: z.number().min(0),
  end: z.number().min(0),
  scaleFrom: z.number().min(1).max(1.5),
  scaleTo: z.number().min(1).max(1.5),
  xFrom: cameraValueSchema.default(0),
  xTo: cameraValueSchema.default(0),
  yFrom: cameraValueSchema.default(0),
  yTo: cameraValueSchema.default(0)
}).refine((move) => move.end > move.start, {
  message: "Camera move end must be greater than start."
});

export const browserFrameRenderPlanSchema = z.object({
  fps: z.number().int().min(1).max(DEFAULT_BROWSER_POC_FPS).default(DEFAULT_BROWSER_POC_FPS),
  width: z.number().int().min(320).max(2160),
  height: z.number().int().min(320).max(3840),
  duration: z.number().positive().max(MAX_BROWSER_POC_DURATION_SECONDS),
  captionStyle: browserFrameCaptionStyleSchema.default(DEFAULT_BROWSER_FRAME_STYLE),
  captions: z.array(browserFrameCaptionSchema).default([]),
  cameraMoves: z.array(browserFrameCameraMoveSchema).default([])
}).superRefine((plan, ctx) => {
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
});

export type BrowserFrameCaptionStyle = z.infer<typeof browserFrameCaptionStyleSchema>;
export type BrowserFrameWord = z.infer<typeof browserFrameWordSchema>;
export type BrowserFrameCaption = z.infer<typeof browserFrameCaptionSchema>;
export type BrowserFrameCameraMove = z.infer<typeof browserFrameCameraMoveSchema>;
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
    "Это browser frame renderer POC для Montazhor",
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
    captions: captions.map((text, index) =>
      buildDemoCaption({
        id: `caption-${index + 1}`,
        text,
        start: roundTime(segmentDuration * index),
        end: roundTime(index === captions.length - 1 ? duration : segmentDuration * (index + 1))
      })
    ),
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
    ]
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
