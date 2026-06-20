import { GET as downloadSubtitled } from "../download-subtitled/route";

export const runtime = "nodejs";

export async function GET(
  request: Parameters<typeof downloadSubtitled>[0],
  context: Parameters<typeof downloadSubtitled>[1]
) {
  return downloadSubtitled(request, context);
}
