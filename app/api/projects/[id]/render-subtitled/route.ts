import { NextResponse } from "next/server";
import {
  enqueueSubtitledVideoRender,
  getProjectJobLabel,
  isProjectJobActive
} from "@/lib/jobs";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (isProjectJobActive(id)) {
    return NextResponse.json({
      ok: true,
      active: true,
      jobLabel: getProjectJobLabel(id)
    });
  }

  try {
    await enqueueSubtitledVideoRender(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 409 });
  }
}
