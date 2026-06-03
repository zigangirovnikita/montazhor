import { basename } from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createVideoResponse, statVideoFile } from "@/lib/videoResponse";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const project = await prisma.project.findUnique({ where: { id } });

  if (!project?.reviewVideoPath) {
    return NextResponse.json({ error: "Review video is not ready yet." }, { status: 404 });
  }

  try {
    statVideoFile(project.reviewVideoPath);
  } catch {
    return NextResponse.json({ error: "Review video file not found on disk." }, { status: 404 });
  }

  return createVideoResponse({
    request,
    filePath: project.reviewVideoPath,
    contentDisposition: `inline; filename="${basename(project.reviewVideoPath)}"`
  });
}
