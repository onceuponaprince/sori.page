import { NextRequest } from "next/server";
import { proxyAgentRequest } from "@/app/api/agent/_proxy";

export const runtime = "nodejs";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ storyUid: string; charId: string }> },
) {
  const { storyUid, charId } = await params;
  const body = await req.json();
  return proxyAgentRequest(req, {
    method: "PUT",
    path: `/api/agent/characters/${storyUid}/${charId}/draft/`,
    body,
  });
}
