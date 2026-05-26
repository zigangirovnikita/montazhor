import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MotionRenderInput, MotionRenderer, MotionInsert } from "@/lib/types";
import { hookTemplate } from "@/server/hyperframes/templates/HookTitleCard";
import { keyPointTemplate } from "@/server/hyperframes/templates/KeyPointCard";
import { ctaTemplate } from "@/server/hyperframes/templates/CTAEndCard";
import { renderHyperframesVideo } from "@/server/hyperframes/render";

export class HyperFramesMotionRenderer implements MotionRenderer {
  async renderInserts(input: MotionRenderInput): Promise<MotionInsert[]> {
    const rendered: MotionInsert[] = [];
    for (const insert of input.inserts) {
      const dir = path.join(input.projectDir, "motion", insert.id);
      const output = path.join(dir, `${insert.id}.mp4`);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, "index.html"), templateFor(insert, input.stylePreset), "utf8");
      await renderHyperframesVideo(dir, output);
      rendered.push({ ...insert, renderPath: output });
    }
    return rendered;
  }
}

function templateFor(insert: MotionInsert, preset: string) {
  if (insert.type === "cta") return ctaTemplate(insert.text, preset);
  if (insert.type === "key_point") return keyPointTemplate(insert.text, preset);
  return hookTemplate(insert.text, preset);
}
