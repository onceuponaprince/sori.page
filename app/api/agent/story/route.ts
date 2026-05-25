import { NextRequest } from "next/server";
import { proxyAgentRequest } from "@/app/api/agent/_proxy";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return proxyAgentRequest(req, {
    method: "GET",
    path: "/api/agent/story/",
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return proxyAgentRequest(req, {
    method: "POST",
    path: "/api/agent/story/",
    body,
  });
}
