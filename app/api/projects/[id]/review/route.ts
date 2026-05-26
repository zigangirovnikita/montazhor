import { createReadStream, statSync } from "node:fs";
import { basename } from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const project = await prisma.project.findUnique({ where: { id } });

  if (!project?.reviewVideoPath) {
    return NextResponse.json({ error: "Review video is not ready yet." }, { status: 404 });
  }

  let stat;
  try {
    stat = statSync(project.reviewVideoPath);
  } catch {
    return NextResponse.json({ error: "Review video file not found on disk." }, { status: 404 });
  }

  const stream = createReadStream(project.reviewVideoPath);
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(stat.size),
      "Content-Disposition": `inline; filename="${basename(project.reviewVideoPath)}"`
    }
  });
}
