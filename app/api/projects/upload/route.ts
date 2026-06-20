import { createWriteStream } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logProject } from "@/lib/logger";
import { ensureProjectStorage, extensionForVideo, sanitizeFilename } from "@/lib/storage";
import { sanitizeTemplateData, templateToVisualPlanOptions } from "@/lib/templateBuilder";
import { optimizeUploadedVideo } from "@/server/video/ingest";

export const runtime = "nodejs";

/** Maximum upload size in bytes (2 GB) */
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Video file is required." }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      const sizeMb = (file.size / 1024 / 1024).toFixed(0);
      const limitMb = (MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0);
      return NextResponse.json(
        { error: `File too large (${sizeMb} MB). Maximum allowed size is ${limitMb} MB.` },
        { status: 413 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Uploaded file is empty." }, { status: 400 });
    }

    const originalFilename = sanitizeFilename(file.name);
    let ext: string;
    try {
      ext = extensionForVideo(originalFilename);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
    }

    const defaultTemplate = await prisma.template.findFirst({ where: { isDefault: true, isPreset: false }, orderBy: { updatedAt: "desc" } });
    const defaultTemplateData = defaultTemplate ? sanitizeTemplateData(defaultTemplate.data, defaultTemplate.name) : null;
    const defaultTemplateOptions = defaultTemplateData ? templateToVisualPlanOptions(defaultTemplateData) : {};

    const project = await prisma.project.create({
      data: {
        originalFilename,
        originalPath: "",
        platform: String(formData.get("platform") ?? "instagram_reels"),
        stylePreset: String(formData.get("stylePreset") ?? "clean_expert"),
        language: String(formData.get("language") ?? "auto"),
        durationTarget: String(formData.get("durationTarget") ?? "auto"),
        cleanupMode: "pauses_and_fillers",
        editMode: "cut_subtitles",
        presentationMode: "subtitles_only",
        styleOptionsJson: JSON.stringify({
          subtitleFont: "manrope",
          subtitleStyle: "active_word",
          subtitleBackdrop: "glass",
          infographicTone: "glass",
          infographicAccent: "mint",
          visualDensity: "medium",
          motionIntensity: "medium",
          presetPack: "educational",
          disabledTemplates: [],
          ...defaultTemplateOptions,
          visualTemplateId: defaultTemplate?.id,
          visualTemplate: defaultTemplateData ?? undefined
        })
      }
    });

    let originalPath = "";
    let tempUploadPath: string | undefined;
    try {
      const paths = await ensureProjectStorage(project.id);
      tempUploadPath = path.join(paths.upload, `upload${ext}`);
      originalPath = paths.original(".mp4");
      await pipeline(Readable.fromWeb(file.stream() as unknown as NodeReadableStream), createWriteStream(tempUploadPath));
      await optimizeUploadedVideo(tempUploadPath, originalPath);
      await unlink(tempUploadPath).catch(() => {});
    } catch (writeError) {
      if (tempUploadPath) {
        await unlink(tempUploadPath).catch(() => {});
      }
      // Clean up the project record if file write fails
      await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
      throw writeError;
    }

    await prisma.project.update({
      where: { id: project.id },
      data: { originalPath }
    });
    const optimizedStat = await stat(originalPath);
    await logProject(
      project.id,
      "info",
      `Upload received: ${originalFilename}, ${(file.size / 1024 / 1024).toFixed(1)} MB. Optimized source saved as MP4 ${(optimizedStat.size / 1024 / 1024).toFixed(1)} MB with normalized Full HD orientation and max bitrate 4000k.`
    );

    return NextResponse.json({ projectId: project.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Upload failed: ${message}` }, { status: 500 });
  }
}
