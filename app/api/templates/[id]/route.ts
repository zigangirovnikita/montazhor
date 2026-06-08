import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sanitizeTemplateData } from "@/lib/templateBuilder";
import { builtinTemplateById, serializeTemplate } from "../presetHelpers";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const preset = builtinTemplateById(id);
  if (preset) return NextResponse.json({ template: preset });

  const row = await prisma.template.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Template was not found." }, { status: 404 });

  return NextResponse.json({ template: serializeTemplate(row) });
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (builtinTemplateById(id)) {
    return NextResponse.json({ error: "Built-in presets are read-only. Duplicate it first." }, { status: 409 });
  }

  const existing = await prisma.template.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Template was not found." }, { status: 404 });
  if (existing.isPreset) return NextResponse.json({ error: "Preset templates are read-only." }, { status: 409 });

  const body = (await request.json().catch(() => ({}))) as { name?: unknown; data?: unknown };
  const data = sanitizeTemplateData(body.data ?? existing.data, typeof body.name === "string" ? body.name : existing.name);
  const row = await prisma.template.update({
    where: { id },
    data: {
      name: data.name,
      data: data as unknown as Prisma.InputJsonValue
    }
  });

  return NextResponse.json({ template: serializeTemplate(row) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (builtinTemplateById(id)) {
    return NextResponse.json({ error: "Built-in presets cannot be deleted." }, { status: 409 });
  }

  const existing = await prisma.template.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Template was not found." }, { status: 404 });
  if (existing.isPreset) return NextResponse.json({ error: "Preset templates cannot be deleted." }, { status: 409 });

  if (existing.isDefault) {
    const fallback = await prisma.template.findFirst({
      where: { id: { not: id }, isPreset: false },
      orderBy: { updatedAt: "desc" }
    });
    if (fallback) {
      await prisma.$transaction([
        prisma.template.delete({ where: { id } }),
        prisma.template.update({ where: { id: fallback.id }, data: { isDefault: true } })
      ]);
      return NextResponse.json({ ok: true });
    }
  }

  await prisma.template.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
