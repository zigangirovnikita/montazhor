import { NextResponse } from "next/server";
import { enqueueAnalyze, isProjectJobActive } from "@/lib/jobs";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (isProjectJobActive(id)) {
    return NextResponse.json({ ok: true, active: true });
  }
  try {
    await enqueueAnalyze(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 409 });
  }
}
