import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sanitizeTemplateData, templateDataToJson } from "@/lib/templateBuilder";
import { builtinTemplateById, clonePresetData } from "../../presetHelpers";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { name?: unknown; makeDefault?: unknown };
  const preset = builtinTemplateById(id);
  const source = preset
    ? { name: preset.name, data: preset.data }
    : await prisma.template.findUnique({ where: { id }, select: { name: true, data: true } });

  if (!source) return NextResponse.json({ error: "Template was not found." }, { status: 404 });

  const copyData = clonePresetData(
    sanitizeTemplateData(source.data, source.name),
    typeof body.name === "string" ? body.name : `${source.name} copy`
  );

  if (body.makeDefault === true) {
    await prisma.template.updateMany({ data: { isDefault: false } });
  }

  const row = await prisma.template.create({
    data: {
      name: copyData.name,
      data: templateDataToJson(copyData) as Prisma.InputJsonValue,
      isPreset: false,
      isDefault: body.makeDefault === true
    }
  });

  return NextResponse.json({
    template: {
      id: row.id,
      name: row.name,
      data: sanitizeTemplateData(row.data, row.name),
      isPreset: row.isPreset,
      isDefault: row.isDefault,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }
  }, { status: 201 });
}
