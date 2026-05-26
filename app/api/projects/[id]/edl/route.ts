import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { pathsForProject } from "@/lib/storage";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    return NextResponse.json(JSON.parse(await readFile(pathsForProject(id).edl, "utf8")));
  } catch {
    return NextResponse.json({ error: "Edit decision list is not ready yet." }, { status: 404 });
  }
}
