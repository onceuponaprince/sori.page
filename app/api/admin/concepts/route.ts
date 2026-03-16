import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * GET /api/admin/concepts — List concepts with optional filters.
 *
 * Query params:
 *   ?status=proposed|under_review|pending_consensus|canonized
 *   ?q=search+term
 *
 * Proxies to the Django backend. Falls back to an empty list if
 * the backend is unreachable.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const query = searchParams.get("q");

  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (query) params.set("q", query);

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/graph/concepts/?${params.toString()}`,
      { next: { revalidate: 0 } },
    );
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
    return NextResponse.json(
      { error: "Backend error", status: res.status },
      { status: res.status },
    );
  } catch {
    // Backend not available — return empty results
    return NextResponse.json({
      results: [],
      source: "fallback",
      message: "Backend not reachable. No concepts to display.",
    });
  }
}

/**
 * POST /api/admin/concepts — Create a new concept node.
 *
 * Body: { name, description, status?, depth_score? }
 *
 * Proxies to the Django backend. Returns an error if the
 * backend is unreachable.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { name, description, status, depth_score } = body as {
    name?: string;
    description?: string;
    status?: string;
    depth_score?: number;
  };

  if (!name || !description) {
    return NextResponse.json(
      { error: "name and description are required" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/graph/concepts/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        status: status || "proposed",
        depth_score: depth_score ?? 1,
        confidence: 1.0,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data, { status: 201 });
    }

    const errText = await res.text();
    return NextResponse.json(
      { error: "Backend rejected the request", detail: errText },
      { status: res.status },
    );
  } catch {
    return NextResponse.json(
      { error: "Backend not reachable. Cannot create concept." },
      { status: 503 },
    );
  }
}
