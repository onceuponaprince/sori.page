import { NextRequest } from "next/server";
import { proxyAgentRequest } from "@/app/api/agent/_proxy";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ storyUid: string }> },
) {
  const { storyUid } = await params;
  const body = await req.json();
  return proxyAgentRequest(req, {
    method: "POST",
    path: `/api/agent/characters/${storyUid}/component/`,
    body,
  });
}
