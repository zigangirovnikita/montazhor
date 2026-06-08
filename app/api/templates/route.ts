import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sanitizeTemplateData, templateDataToJson, type StoredTemplate } from "@/lib/templateBuilder";
import { builtinStoredTemplates } from "./presetHelpers";

export const runtime = "nodejs";

export async function GET() {
  const rows = await prisma.template.findMany({ orderBy: [{ isPreset: "desc" }, { updatedAt: "desc" }] });
  const templates: StoredTemplate[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    data: sanitizeTemplateData(row.data, row.name),
    isPreset: row.isPreset,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }));

  return NextResponse.json({ templates: [...builtinStoredTemplates(), ...templates] });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { name?: unknown; data?: unknown };
  const data = sanitizeTemplateData(body.data, typeof body.name === "string" ? body.name : "Мой шаблон");
  const row = await prisma.template.create({
    data: {
      name: data.name,
      data: templateDataToJson(data) as Prisma.InputJsonValue,
      isPreset: false,
      isDefault: false
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
