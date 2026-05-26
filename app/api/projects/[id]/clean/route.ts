import { createReadStream, statSync } from "node:fs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pathsForProject } from "@/lib/storage";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Project was not found." }, { status: 404 });
  }

  const cleanPath = pathsForProject(id).cleanVideo;
  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(cleanPath);
  } catch {
    return NextResponse.json({ error: "Clean cut preview is not ready yet." }, { status: 404 });
  }

  const stream = createReadStream(cleanPath);
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(stat.size),
      "Content-Disposition": `inline; filename="clean-${id}.mp4"`
    }
  });
}
