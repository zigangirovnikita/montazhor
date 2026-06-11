import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveAppDir } from "@/lib/runtimePaths";

const ROOT = resolveStorageRoot(process.env.STORAGE_ROOT ?? "storage");

export function storageRoot() {
  return ROOT;
}

function resolveStorageRoot(value: string) {
  if (path.isAbsolute(value)) return value;
  return path.join(resolveAppDir(), value);
}

export function sanitizeFilename(filename: string) {
  const basename = path.basename(filename).replace(/[^\w.\-]+/g, "_");
  return basename || "upload.mp4";
}

export function extensionForVideo(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (![".mp4", ".mov", ".webm"].includes(ext)) {
    throw new Error("Unsupported video type. Upload mp4, mov, or webm.");
  }
  return ext;
}

export function projectDir(projectId: string) {
  return path.join(ROOT, "projects", projectId);
}

export function uploadDir(projectId: string) {
  return path.join(ROOT, "uploads", projectId);
}

export function pathsForProject(projectId: string) {
  const project = projectDir(projectId);
  return {
    project,
    upload: uploadDir(projectId),
    original: (ext: string) => path.join(uploadDir(projectId), `original${ext}`),
    audio: path.join(project, "audio.wav"),
    metadata: path.join(project, "metadata.json"),
    transcript: path.join(project, "transcript.json"),
    edl: path.join(project, "edl.json"),
    reviewCandidates: path.join(project, "review-candidates.json"),
    contentPlan: path.join(project, "content-plan.json"),
    visualPlan: path.join(project, "visual-plan.json"),
    subtitlesDraft: path.join(project, "subtitles-draft.json"),
    subtitlesAss: path.join(project, "subtitles.ass"),
    subtitlesOverlayMp4: path.join(project, "subtitles-overlay.mp4"),
    semanticOverlayMp4: path.join(project, "semantic-overlay.mp4"),
    cleanVideo: path.join(project, "clean.mp4"),
    infographicVideo: path.join(project, "infographic.mp4"),
    splitVideo: path.join(project, "split.mp4"),
    subtitledVideo: path.join(project, "subtitled.mp4"),
    reviewVideo: path.join(project, "review.mp4"),
    finalVideo: path.join(project, "final.mp4"),
    motionDir: path.join(project, "motion")
  };
}

export async function ensureProjectStorage(projectId: string) {
  const paths = pathsForProject(projectId);
  await mkdir(paths.upload, { recursive: true });
  await mkdir(paths.project, { recursive: true });
  await mkdir(paths.motionDir, { recursive: true });
  return paths;
}

export async function writeJsonFile(filePath: string, data: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
