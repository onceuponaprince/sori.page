import { NextRequest } from "next/server";
import { proxyAgentRequest } from "@/app/api/agent/_proxy";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ storyUid: string; charId: string }> },
) {
  const { storyUid, charId } = await params;
  const body = await req.json().catch(() => ({}));
  return proxyAgentRequest(req, {
    method: "POST",
    path: `/api/agent/characters/${storyUid}/${charId}/publish/`,
    body,
  });
}
