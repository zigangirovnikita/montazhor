import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sanitizeTemplateData } from "@/lib/templateBuilder";
import { builtinTemplateById, clonePresetData, serializeTemplate } from "../../presetHelpers";

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

  const isMakeDefault = body.makeDefault === true;
  
  let row;
  if (isMakeDefault) {
    const transaction = await prisma.$transaction([
      prisma.template.updateMany({ data: { isDefault: false } }),
      prisma.template.create({
        data: {
          name: copyData.name,
          data: copyData as unknown as Prisma.InputJsonValue,
          isPreset: false,
          isDefault: true
        }
      })
    ]);
    row = transaction[1];
  } else {
    row = await prisma.template.create({
      data: {
        name: copyData.name,
        data: copyData as unknown as Prisma.InputJsonValue,
        isPreset: false,
        isDefault: false
      }
    });
  }

  return NextResponse.json({
    template: serializeTemplate(row)
  }, { status: 201 });
}
