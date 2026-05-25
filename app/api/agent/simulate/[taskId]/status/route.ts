import { NextRequest } from "next/server";
import { proxyAgentRequest } from "@/app/api/agent/_proxy";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { taskId: string } },
) {
  return proxyAgentRequest(req, {
    method: "GET",
    path: `/api/agent/simulate/${params.taskId}/status/`,
  });
}
