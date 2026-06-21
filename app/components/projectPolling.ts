export function shouldPollProject(status: string | undefined, busy: boolean, editBusy: boolean) {
  if (busy || editBusy) return true;
  if (!status) return true;
  return !["uploaded", "draft_ready", "review_ready", "done", "error"].includes(status);
}
