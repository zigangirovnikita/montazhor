import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sanitizeTemplateData } from "@/lib/templateBuilder";
import { builtinTemplateById } from "../../presetHelpers";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (builtinTemplateById(id)) {
    return NextResponse.json({ error: "Duplicate a built-in preset before making it default." }, { status: 409 });
  }

  const existing = await prisma.template.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Template was not found." }, { status: 404 });
  if (existing.isPreset) return NextResponse.json({ error: "Preset templates cannot be the app default directly." }, { status: 409 });

  await prisma.template.updateMany({ data: { isDefault: false } });
  const row = await prisma.template.update({ where: { id }, data: { isDefault: true } });

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
  });
}
