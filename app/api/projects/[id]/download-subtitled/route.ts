import { NextResponse } from "next/server";
import { pathsForProject } from "@/lib/storage";
import { createVideoResponse, statVideoFile } from "@/lib/videoResponse";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const outputPath = pathsForProject(id).subtitledVideo;

  try {
    statVideoFile(outputPath);
  } catch {
    return NextResponse.json({ error: "Subtitled video is not ready yet." }, { status: 404 });
  }

  return createVideoResponse({
    request,
    filePath: outputPath,
    contentDisposition: `attachment; filename="montazhor-${id}-subtitled.mp4"`
  });
}
