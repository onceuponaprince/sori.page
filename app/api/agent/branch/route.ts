import { NextRequest } from "next/server";
import { proxyAgentRequest } from "@/app/api/agent/_proxy";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  return proxyAgentRequest(req, {
    method: "POST",
    path: "/api/agent/branch/",
    body,
  });
}
