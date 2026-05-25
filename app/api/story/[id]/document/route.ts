import { NextRequest } from "next/server";
import { proxyAgentRequest } from "@/app/api/agent/_proxy";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyAgentRequest(req, {
    method: "GET",
    path: `/api/agent/story/${id}/document/`,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  return proxyAgentRequest(req, {
    method: "PUT",
    path: `/api/agent/story/${id}/document/`,
    body,
  });
}
