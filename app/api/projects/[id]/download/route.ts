import { createReadStream, statSync } from "node:fs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project?.finalVideoPath) {
    return NextResponse.json({ error: "Final video is not ready yet." }, { status: 404 });
  }

  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(project.finalVideoPath);
  } catch {
    return NextResponse.json({ error: "Final video file not found on disk." }, { status: 404 });
  }

  const stream = createReadStream(project.finalVideoPath);
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(stat.size),
      "Content-Disposition": `attachment; filename="montazhor-${id}.mp4"`
    }
  });
}
