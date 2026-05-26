import { writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { ensureProjectStorage } from "@/lib/storage";
import { DeterministicVoiceCommandProcessor } from "@/server/ai/voiceCommandProcessor";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const formData = await request.formData();
  const audio = formData.get("audio");
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Voice command audio is required." }, { status: 400 });
  }
  const paths = await ensureProjectStorage(id);
  const audioPath = path.join(paths.project, `voice-command-${Date.now()}.webm`);
  await writeFile(audioPath, Buffer.from(await audio.arrayBuffer()));
  const processor = new DeterministicVoiceCommandProcessor();
  const result = await processor.process({ projectId: id, audioPath });
  return NextResponse.json(result);
}
