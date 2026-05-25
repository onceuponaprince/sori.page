import { NextRequest, NextResponse } from "next/server";
import {
  formatAgentProxyError,
  isAuthContextError,
} from "@/lib/auth-errors";
import { fetchContextEngine } from "@/lib/context-engine-gateway";
import { requireRequestContext } from "@/lib/request-context";

type ProxyMethod = "GET" | "POST" | "PUT" | "DELETE";

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
    headers.set("X-User-Id", context.userId);
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
    const status = isAuthContextError(message) ? 401 : 502;
    return NextResponse.json(
      { error: status === 401 ? message : formatAgentProxyError(error) },
      { status },
    );
  }
}
