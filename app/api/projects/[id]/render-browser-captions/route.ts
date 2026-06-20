import { POST as renderSubtitled } from "../render-subtitled/route";

export const runtime = "nodejs";

export async function POST(
  request: Parameters<typeof renderSubtitled>[0],
  context: Parameters<typeof renderSubtitled>[1]
) {
  return renderSubtitled(request, context);
}
