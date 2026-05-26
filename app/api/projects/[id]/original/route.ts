import { readFile, stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
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
  const file = await readFile(project.originalPath);
  return new NextResponse(file, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `inline; filename="${project.originalFilename}"`
    }
  });
}
