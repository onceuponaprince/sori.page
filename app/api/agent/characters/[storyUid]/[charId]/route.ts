import { NextRequest } from "next/server";
import { proxyAgentRequest } from "@/app/api/agent/_proxy";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storyUid: string; charId: string }> },
) {
  const { storyUid, charId } = await params;
  return proxyAgentRequest(req, {
    method: "GET",
    path: `/api/agent/characters/${storyUid}/${charId}/`,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ storyUid: string; charId: string }> },
) {
  const { storyUid, charId } = await params;
  return proxyAgentRequest(req, {
    method: "DELETE",
    path: `/api/agent/characters/${storyUid}/${charId}/`,
  });
}
