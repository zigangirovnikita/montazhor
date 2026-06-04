import { stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createVideoResponse } from "@/lib/videoResponse";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Project was not found." }, { status: 404 });
  }
  try {
    await stat(project.originalPath);
  } catch {
    return NextResponse.json({ error: "Original source was deleted after final render cleanup." }, { status: 404 });
  }
  return createVideoResponse({
    request,
    filePath: project.originalPath,
    contentDisposition: `inline; filename="${project.originalFilename}"`
  });
}
