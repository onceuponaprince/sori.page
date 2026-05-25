import { NextRequest, NextResponse } from "next/server";
import { fetchContextEngine } from "@/lib/context-engine-gateway";
import { requireRequestContext } from "@/lib/request-context";

type ProxyMethod = "GET" | "POST";

interface ProxyOptions {
  method: ProxyMethod;
  path: string;
  body?: unknown;
}

export async function proxyAgentRequest(
  req: NextRequest,
  options: ProxyOptions,
) {
  try {
    const context = await requireRequestContext(req);

    const headers = new Headers();
    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    const upstream = await fetchContextEngine(context.tenantId, options.path, {
      method: options.method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });

    const payload = await upstream.json().catch(() => null);
    return NextResponse.json(payload, { status: upstream.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message === "Authentication required" ||
      message === "Invalid auth token" ||
      message === "Tenant access denied"
        ? 401
        : 502;
    return NextResponse.json(
      { error: status === 401 ? message : "Backend unavailable" },
      { status },
    );
  }
}
