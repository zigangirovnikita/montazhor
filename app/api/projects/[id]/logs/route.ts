import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const logs = await prisma.processingLog.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" }
  });
  return NextResponse.json({ logs });
}
