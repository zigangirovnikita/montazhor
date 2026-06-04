import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createVideoResponse, statVideoFile } from "@/lib/videoResponse";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project?.finalVideoPath) {
    return NextResponse.json({ error: "Final video is not ready yet." }, { status: 404 });
  }

  try {
    statVideoFile(project.finalVideoPath);
  } catch {
    return NextResponse.json({ error: "Final video file not found on disk." }, { status: 404 });
  }

  return createVideoResponse({
    request,
    filePath: project.finalVideoPath,
    contentDisposition: `attachment; filename="montazhor-${id}.mp4"`
  });
}
