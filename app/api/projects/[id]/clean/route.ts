import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pathsForProject } from "@/lib/storage";
import { createVideoResponse, statVideoFile } from "@/lib/videoResponse";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Project was not found." }, { status: 404 });
  }

  const cleanPath = pathsForProject(id).cleanVideo;
  try {
    statVideoFile(cleanPath);
  } catch {
    return NextResponse.json({ error: "Clean cut preview is not ready yet." }, { status: 404 });
  }

  return createVideoResponse({
    request,
    filePath: cleanPath,
    contentDisposition: `inline; filename="clean-${id}.mp4"`
  });
}
