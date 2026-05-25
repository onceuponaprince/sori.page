import { NextRequest } from "next/server";
import { proxyAgentRequest } from "@/app/api/agent/_proxy";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  return proxyAgentRequest(req, {
    method: "GET",
    path: `/api/agent/chat/${threadId}/`,
  });
}
