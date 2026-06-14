import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { logStageEvent } from "@/server/render/stageProgress";

export interface StageResult {
  stageName: string;
  cacheKey: string;
  outputPath: string;
  cached: boolean;
  durationMs: number;
  outputSize?: number;
}

/**
 * Fast fingerprint for large video files.
 * Uses file size + mtime + basename to avoid hashing gigabytes of data.
 * Full SHA-256 should be computed once at upload and stored in DB.
 */
export async function fingerprintFile(filePath: string): Promise<string> {
  const info = await stat(filePath);
  const hash = createHash("sha256");
  hash.update(`${filePath}:${info.size}:${info.mtimeMs.toFixed(0)}`);
  return hash.digest("hex").slice(0, 32);
}

/**
 * SHA-256 hash of a JSON-serializable value.
 * For small payloads (transcripts, EDLs, scene plans, content plans).
 */
export function hashJson(data: unknown): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(data));
  return hash.digest("hex").slice(0, 32);
}

function cachekeyPath(outputPath: string): string {
  return `${outputPath}.cachekey`;
}

async function readCachekey(outputPath: string): Promise<string | null> {
  try {
    return (await readFile(cachekeyPath(outputPath), "utf8")).trim();
  } catch {
    return null;
  }
}

async function writeCachekey(outputPath: string, cacheKey: string): Promise<void> {
  await writeFile(cachekeyPath(outputPath), cacheKey, "utf8");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fileSizeBytes(filePath: string): Promise<number | undefined> {
  try {
    const info = await stat(filePath);
    return info.size;
  } catch {
    return undefined;
  }
}

/**
 * Core stage-level caching primitive.
 *
 * Checks if `outputPath` exists and its `.cachekey` sidecar matches `cacheKey`.
 * If cache hit: logs "cache_hit" and skips the render.
 * If cache miss: runs `render()`, writes the sidecar, logs timing.
 *
 * Replaces the old pattern of `safeUnlink(outputPath)` + always re-render.
 */
export async function ensureArtifact(
  projectId: string,
  stageName: string,
  cacheKey: string,
  outputPath: string,
  render: (signal?: AbortSignal) => Promise<void>,
  options?: { timeoutMs?: number }
): Promise<StageResult> {
  const startedAt = Date.now();

  // Check cache
  const exists = await fileExists(outputPath);
  if (exists) {
    const stored = await readCachekey(outputPath);
    if (stored === cacheKey) {
      const outputSize = await fileSizeBytes(outputPath);
      await logStageEvent(projectId, {
        stage: stageName,
        status: "cache_hit",
        startedAt,
        durationMs: Date.now() - startedAt,
        inputHash: cacheKey,
        outputPath,
        outputSize,
      });
      return { stageName, cacheKey, outputPath, cached: true, durationMs: Date.now() - startedAt, outputSize };
    }
  }

  // Cache miss — render
  await logStageEvent(projectId, {
    stage: stageName,
    status: "started",
    startedAt,
    inputHash: cacheKey,
    outputPath,
  });

  try {
    const controller = new AbortController();
    if (options?.timeoutMs) {
      const timeoutId = setTimeout(() => {
        controller.abort(new Error(`Stage ${stageName} timed out after ${options.timeoutMs}ms`));
      }, options.timeoutMs);
      
      try {
        await Promise.race([
          render(controller.signal),
          new Promise<never>((_, reject) => {
            const onAbort = () => reject(controller.signal.reason);
            if (controller.signal.aborted) return onAbort();
            controller.signal.addEventListener("abort", onAbort);
          })
        ]);
      } finally {
        clearTimeout(timeoutId);
      }
    } else {
      await render(controller.signal);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logStageEvent(projectId, {
      stage: stageName,
      status: "failed",
      startedAt,
      durationMs: Date.now() - startedAt,
      inputHash: cacheKey,
      outputPath,
      error: message,
    });
    throw error;
  }

  // Write cachekey sidecar
  await writeCachekey(outputPath, cacheKey);

  const durationMs = Date.now() - startedAt;
  const outputSize = await fileSizeBytes(outputPath);

  await logStageEvent(projectId, {
    stage: stageName,
    status: "done",
    startedAt,
    durationMs,
    inputHash: cacheKey,
    outputPath,
    outputSize,
  });

  return { stageName, cacheKey, outputPath, cached: false, durationMs, outputSize };
}

/**
 * Invalidate a cached artifact by removing its .cachekey sidecar.
 * The artifact file itself is NOT deleted — only the cache validity marker.
 * Next `ensureArtifact` call will see a cache miss and re-render.
 */
export async function invalidateArtifact(outputPath: string): Promise<void> {
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(cachekeyPath(outputPath));
  } catch {
    // Sidecar may not exist — that's fine
  }
}
