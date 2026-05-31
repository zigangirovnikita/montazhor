import { NextResponse } from "next/server";
import { isProjectJobActive } from "@/lib/jobs";
import { applyDraftEdit } from "@/server/pipeline/applyDraftEdit";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const ACTIONS = new Set(["restore_removed_range", "delete_range", "delete_word", "reset_draft"]);

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (isProjectJobActive(id)) {
    return NextResponse.json({ error: "Проект сейчас обрабатывается. Подожди завершения текущего шага." }, { status: 409 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown;
    sourceStart?: unknown;
    sourceEnd?: unknown;
  };
  const action = String(body.action ?? "");

  if (!ACTIONS.has(action)) {
    return NextResponse.json({ error: "Unknown draft edit action." }, { status: 400 });
  }

  try {
    const edl = await applyDraftEdit(id, {
      action: action as "restore_removed_range" | "delete_range" | "delete_word" | "reset_draft",
      sourceStart: Number(body.sourceStart),
      sourceEnd: Number(body.sourceEnd)
    });
    return NextResponse.json({ ok: true, edl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 409 });
  }
}
