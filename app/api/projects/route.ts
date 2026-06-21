import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true,
      originalFilename: true,
      status: true,
      durationOriginal: true,
      durationFinal: true,
      platform: true,
      stylePreset: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return NextResponse.json({
    projects: projects.map((project) => ({
      ...project,
      previewUrl: `/api/projects/${project.id}/original?v=${project.updatedAt.getTime()}`
    }))
  });
}
