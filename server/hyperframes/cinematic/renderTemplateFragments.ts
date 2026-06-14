import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TemplateInstancePlan } from "@/lib/types/visual";
import { renderHyperframesVideo } from "@/server/hyperframes/render";
import { renderTemplateInstanceHtml } from "@/server/hyperframes/templates/ais/renderTemplateHtml";
import type { RenderProfile } from "@/server/video/encoding";
import type { VideoProfile } from "@/server/video/profile";
import { ensureArtifact, fingerprintFile, hashJson } from "@/server/render/renderGraph";
import { VISUAL_DIRECTOR_VERSION } from "@/server/visual/visualDirector";
import { pathsForProject } from "@/lib/storage";

export async function renderTemplateFragments(
  projectId: string,
  cleanVideoPath: string,
  plan: TemplateInstancePlan,
  profile: VideoProfile,
  renderProfile: RenderProfile
) {
  const paths = pathsForProject(projectId);
  const motionDir = path.join(paths.sceneFragmentsDir, renderProfile);
  await mkdir(motionDir, { recursive: true });

  const cleanFingerprint = await fingerprintFile(cleanVideoPath);
  const fragmentPaths: string[] = [];
  const fragmentCacheKeys: string[] = [];

  for (const [index, instance] of plan.instances.entries()) {
    const fragmentName = `inst_${index}.mp4`;
    const fragmentPath = path.join(motionDir, fragmentName);
    
    // Explicit cache key based on exactly what affects this instance
    const cacheKey = [
      cleanFingerprint,
      instance.templateId,
      instance.variantId,
      hashJson(instance.slots),
      instance.start,
      instance.duration,
      instance.visualWeight,
      instance.transitionIn,
      instance.transitionOut,
      VISUAL_DIRECTOR_VERSION,
      hashJson(profile),
      renderProfile
    ].join(":");

    await ensureArtifact(
      projectId,
      `template_inst_${index}_${renderProfile}`,
      cacheKey,
      fragmentPath,
      async (signal) => {
        const tempDir = path.join(motionDir, `temp_inst_${index}`);
        await mkdir(tempDir, { recursive: true });
        
        const html = renderTemplateInstanceHtml(instance, profile);
        await writeFile(path.join(tempDir, "index.html"), html, "utf8");
        
        await renderHyperframesVideo(tempDir, fragmentPath, { signal, normalize: false });
      },
      { timeoutMs: 2 * 60_000 }
    );
    
    fragmentCacheKeys.push(cacheKey);
    fragmentPaths.push(fragmentPath);
  }

  return { fragmentPaths, fragmentCacheKeys, cleanFingerprint };
}
