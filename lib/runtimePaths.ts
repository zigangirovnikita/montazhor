import fs from "node:fs";
import path from "node:path";

function looksLikeAppRoot(dir: string) {
  return fs.existsSync(path.join(dir, "package.json")) && fs.existsSync(path.join(dir, "prisma", "schema.prisma"));
}

export function resolveAppDir() {
  const explicit = [process.env.APP_DIR, process.env.MONTAZHOR_APP_DIR].filter((value): value is string => Boolean(value));
  for (const candidate of explicit) {
    if (looksLikeAppRoot(candidate)) return candidate;
  }

  const cwd = process.cwd();
  const candidates = [
    cwd,
    path.resolve(cwd, ".."),
    path.resolve(cwd, "../.."),
    path.resolve(cwd, "../../..")
  ];

  for (const candidate of candidates) {
    if (looksLikeAppRoot(candidate)) return candidate;
  }

  if (cwd.endsWith(`${path.sep}.next${path.sep}standalone`)) {
    return path.resolve(cwd, "../..");
  }

  return cwd;
}

export function resolveStorageDir() {
  return path.join(resolveAppDir(), "storage");
}
