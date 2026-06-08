import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sanitizeTemplateData } from "@/lib/templateBuilder";
import { builtinStoredTemplates, serializeTemplate } from "./presetHelpers";

export const runtime = "nodejs";

export async function GET() {
  const rows = await prisma.template.findMany({
    orderBy: { createdAt: "desc" }
  });

  const templates = rows.map(serializeTemplate);

  return NextResponse.json({ templates: [...builtinStoredTemplates(), ...templates] });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { name?: unknown; data?: unknown };
  const data = sanitizeTemplateData(body.data, typeof body.name === "string" ? body.name : "Мой шаблон");
  
  const row = await prisma.template.create({
    data: {
      name: data.name,
      data: data as unknown as Prisma.InputJsonValue,
      isPreset: false,
      isDefault: false
    }
  });

  return NextResponse.json({
    template: serializeTemplate(row)
  }, { status: 201 });
}
