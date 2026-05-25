import { NextRequest } from "next/server";
import { fetchContextEngine } from "@/lib/context-engine-gateway";
import { requireRequestContext } from "@/lib/request-context";
import {
  creditErrorResponse,
  finalizeCreditReservation,
  getCreditCost,
  reserveCredits,
} from "@/lib/credits";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createChatCreditTransform(onComplete: (success: boolean) => Promise<void>) {
  const decoder = new TextDecoder();
  let buffer = "";
  let success = false;
  let sawError = false;

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk);
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6)) as { type?: string };
          if (event.type === "done") success = true;
          if (event.type === "error") sawError = true;
        } catch {
          // Ignore malformed SSE chunks.
        }
      }
    },
    async flush() {
      await onComplete(success && !sawError);
    },
  });
}

export async function POST(req: NextRequest) {
  let operationKey: string | null = null;
  let requestId: string | null = null;
  const creditCost = getCreditCost("chat_message");

  try {
    const context = await requireRequestContext(req);
    requestId = context.requestId;
    operationKey = `${context.idempotencyKey}:chat`;

    const rate = checkRateLimit(
      `chat:${context.tenantId ?? "user"}:${context.tenantId ?? context.userId}`,
    );
    if (!rate.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rate.retryAfterSec),
          "X-Request-Id": context.requestId,
        },
      });
    }

    const creditResult = await reserveCredits({
      userId: context.userId,
      tenantId: context.tenantId,
      cost: creditCost,
      operationKey,
      reason: "character_chat",
    });
    if (!creditResult.allowed) {
      return creditErrorResponse({
        error: creditResult.error,
        requestId: context.requestId,
      });
    }

    const body = await req.json();

    const upstream = await fetchContextEngine(context.tenantId, "/api/agent/chat/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!upstream.ok) {
      await finalizeCreditReservation({
        operationKey,
        success: false,
        requestId: context.requestId,
      });
      const payload = await upstream.json().catch(() => null);
      return Response.json(payload ?? { error: "Chat failed" }, {
        status: upstream.status,
      });
    }

    if (!upstream.body) {
      await finalizeCreditReservation({
        operationKey,
        success: false,
        requestId: context.requestId,
      });
      return Response.json({ error: "Chat stream unavailable" }, { status: 502 });
    }

    const readable = upstream.body.pipeThrough(
      createChatCreditTransform(async (success) => {
        await finalizeCreditReservation({
          operationKey: operationKey!,
          success,
          requestId: context.requestId,
        });
        if (success) {
          logAudit("chat_success", {
            user_id: context.userId,
            tenant_id: context.tenantId,
            endpoint: "/api/agent/chat",
            credits_delta: -creditCost,
            request_id: context.requestId,
          });
        }
      }),
    );

    return new Response(readable, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Request-Id": context.requestId,
      },
    });
  } catch (error) {
    if (operationKey && requestId) {
      try {
        await finalizeCreditReservation({
          operationKey,
          success: false,
          requestId,
        });
      } catch {
        // Ignore cleanup errors.
      }
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message === "Authentication required" ||
      message === "Invalid auth token" ||
      message === "Tenant access denied"
        ? 401
        : 502;
    return Response.json(
      { error: status === 401 ? message : "Backend unavailable" },
      { status },
    );
  }
}
