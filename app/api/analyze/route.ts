import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  buildFallbackAnalysis,
  type RetrievalContext,
} from "@/lib/analyzer-fallback";
import { getAnalyzerDemo } from "@/lib/analyzer-demos";
import type { AnalyzerResult } from "@/lib/analyzer-types";
import { requireRequestContext } from "@/lib/request-context";
import { checkRateLimit } from "@/lib/rate-limit";
import { reserveCredits, finalizeCreditReservation } from "@/lib/credits";
import { fetchContextEngine } from "@/lib/context-engine-gateway";
import { logAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let operationKey: string | null = null;
  let requestId: string | null = null;
  try {
    const { outline, title, demo_id, story_uid } = (await req.json()) as {
      outline?: string;
      title?: string;
      demo_id?: string;
      story_uid?: string;
    };

    if (!outline?.trim() && !demo_id) {
      return jsonError("Outline is required", 400);
    }

    let authContext: Awaited<ReturnType<typeof requireRequestContext>> | null = null;
    if (!demo_id) {
      authContext = await requireRequestContext(req);
      requestId = authContext.requestId;
      operationKey = `${authContext.idempotencyKey}:analyze`;

      const rate = checkRateLimit(
        `analyze:${authContext.tenantId ?? "user"}:${authContext.tenantId ?? authContext.userId}`,
      );
      if (!rate.allowed) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rate.retryAfterSec),
            "X-Request-Id": authContext.requestId,
          },
        });
      }

      const creditResult = await reserveCredits({
        userId: authContext.userId,
        tenantId: authContext.tenantId,
        cost: 1,
        operationKey,
        reason: "analyze_outline",
      });
      if (!creditResult.allowed) {
        return new Response(
          JSON.stringify({ error: creditResult.error || "Not enough credits" }),
          {
            status: 402,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": authContext.requestId,
            },
          },
        );
      }
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const send = (payload: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        };

        try {
          send({ type: "status", status: "reading-outline" });

          if (demo_id) {
            // Landing-page demos go through the same SSE shape as live analysis so
            // the UI only has to learn one protocol.
            const demo = getAnalyzerDemo(demo_id);
            send({
              type: "metadata",
              metadata: {
                source: "demo",
                current_arc: demo.analysis.currentArc,
                confidence: demo.analysis.confidenceLabel,
              },
            });
            send({ type: "status", status: "matching-structural-dna" });
            send({ type: "analysis", analysis: demo.analysis });
            send({ type: "done" });
            controller.close();
            return;
          }

          send({ type: "status", status: "searching-knowledge-graph" });
          const retrieval = await fetchRetrievalContext(
            authContext?.tenantId ?? null,
            {
            outline: outline!,
            title,
            story_uid,
            },
          );

          send({
            type: "metadata",
            metadata: {
              source: retrieval ? "live" : "fallback",
              current_arc: retrieval?.current_arc ?? null,
              graph_hits: retrieval?.confidence_signal?.graph_hits ?? 0,
              instance_hits: retrieval?.confidence_signal?.instance_hits ?? 0,
            },
          });

          send({ type: "status", status: "comparing-masterworks" });
          send({ type: "status", status: "checking-knowledge-flow" });

          // Retrieval stays on Django; this route is responsible for orchestration,
          // streaming UX, and graceful fallback when any dependency is offline.
          const analysis = await buildAnalysis({
            outline: outline!,
            title,
            retrieval,
          });

          send({ type: "analysis", analysis });
          send({ type: "done" });

          if (authContext && operationKey) {
            let generationId: number | null = null;
            try {
              const supabase = createAdminClient();
              const { data: generationRow, error: generationError } = await supabase
                .from("generations")
                .insert({
                  user_id: authContext.userId,
                  generation_type: "beat",
                  input_params: {
                    title,
                    story_uid,
                    kind: "analyze",
                    tenant_id: authContext.tenantId,
                  },
                  output_text: JSON.stringify(analysis),
                  metadata: {
                    retrieval_source: retrieval ? "live" : "fallback",
                  },
                  credits_used: 1,
                })
                .select("id")
                .single();
              if (generationError) throw generationError;
              generationId = generationRow?.id ?? null;
              await finalizeCreditReservation({
                operationKey,
                success: true,
                generationId,
                requestId: authContext.requestId,
              });
              logAudit("analyze_success", {
                user_id: authContext.userId,
                tenant_id: authContext.tenantId,
                endpoint: "/api/analyze",
                credits_delta: -1,
                request_id: authContext.requestId,
              });
            } catch {
              await finalizeCreditReservation({
                operationKey,
                success: false,
                generationId,
                requestId: authContext.requestId,
              });
            }
          }

          controller.close();
        } catch (error) {
          if (authContext && operationKey) {
            await finalizeCreditReservation({
              operationKey,
              success: false,
              requestId: authContext.requestId,
            });
          }
          send({ type: "error", error: toErrorMessage(error) });
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        ...(requestId ? { "X-Request-Id": requestId } : {}),
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
    const message = toErrorMessage(error);
    const status =
      message === "Authentication required" ||
      message === "Invalid auth token" ||
      message === "Tenant access denied"
        ? 401
        : 500;
    return jsonError(message, status);
  }
}

async function fetchRetrievalContext(tenantId: string | null, params: {
  outline: string;
  title?: string;
  story_uid?: string;
}): Promise<RetrievalContext | null> {
  try {
    const response = await fetchContextEngine(tenantId, "/api/retrieval/analyze/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as RetrievalContext;
  } catch {
    return null;
  }
}

async function buildAnalysis(params: {
  outline: string;
  title?: string;
  retrieval: RetrievalContext | null;
}): Promise<AnalyzerResult> {
  if (!anthropic) {
    return buildFallbackAnalysis(params);
  }

  // Build the fallback first so we always have a deterministic, handoff-friendly
  // result shape even if the model errors or returns malformed JSON.
  const fallback = buildFallbackAnalysis(params);
  const systemPrompt = `You are sori.page's structure analyzer.

You are not a ghostwriter. Never write scenes, dialogue, or paragraphs of fiction.
You only provide structural interpretation, comparative story logic, and gentle writer-facing questions.

Return raw JSON only. No markdown fences. No commentary before or after the JSON.

Use this schema exactly:
{
  "title": string,
  "summary": string,
  "confidenceBand": "emergent" | "steady" | "resonant",
  "confidenceLabel": string,
  "coherenceScore": number,
  "currentArc": string,
  "patternMatches": [{ "id": string, "label": string, "whyItFits": string, "confidence": number, "depthScore": number | null }],
  "crossGenreComparisons": [{ "title": string, "medium": string, "resonance": string, "takeaway": string }],
  "similarStories": [{ "title": string, "medium": string, "resonance": string, "takeaway": string }],
  "timelineWarnings": [{ "label": string, "detail": string, "severity": "low" | "medium" | "high" }],
  "gentleQuestions": [{ "id": string, "prompt": string }],
  "retrievalNotes": string[]
}

Constraints:
- Keep the tone warm, observant, and confidence-building.
- Confidence is about structural coherence, never writing quality.
- Prefer "stories with this pattern tend to..." over commands.
- Use cross-genre comparison when helpful.
- If retrieval context is sparse, stay honest and use the fallback as scaffolding.`;

  const userPrompt = `Writer title: ${params.title || "Untitled outline"}

Outline:
${params.outline}

Neo4j retrieval context:
${JSON.stringify(params.retrieval ?? {}, null, 2)}

Fallback scaffold:
${JSON.stringify(fallback, null, 2)}

Return the final JSON response now.`;

  try {
    const result = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1800,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = result.content
      .map((block) => ("text" in block ? block.text : ""))
      .join("");
    const parsed = extractJson<AnalyzerResult>(text);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function extractJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    // Claude usually follows the JSON-only instruction, but this fallback keeps
    // production resilient if it adds leading text or formatting wrappers.
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(value.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }
}

function toErrorMessage(error: unknown) {
  if (
    error instanceof Error &&
    (error.message === "Authentication required" ||
      error.message === "Invalid auth token" ||
      error.message === "Tenant access denied")
  ) {
    return error.message;
  }
  return error instanceof Error ? error.message : "Analyzer request failed";
}

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
