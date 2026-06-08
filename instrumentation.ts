import { resetStuckProjects } from "@/lib/jobs";

let recoveryStarted = false;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  if (recoveryStarted) {
    return;
  }
  recoveryStarted = true;

  try {
    const resetCount = await resetStuckProjects(0);
    if (resetCount > 0) {
      console.warn(`[startup-recovery] Reset ${resetCount} stuck project(s) to error.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[startup-recovery] Failed to reset stuck projects: ${message}`);
  }
}
