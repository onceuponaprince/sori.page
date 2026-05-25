/**
 * POST /api/story/import/twine
 *
 * Accepts a Twine 2 HTML or Twee 3 text file and forwards a flat
 * node/edge payload to the Django ImportMultiverseView (T14).
 *
 * Body parsing:
 *   - multipart/form-data with `file` (File) and `storyTitle` (string)
 *   - 25 MB cap enforced on the server side; large branching exports
 *     can produce sizeable HTML. Files above that limit are rejected
 *     with 413.
 *
 * The Next.js Node.js runtime does not cap multipart bodies by default,
 * but enforcing here makes the limit explicit and observable.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchContextEngine } from "@/lib/context-engine-gateway";
import { requireRequestContext } from "@/lib/request-context";
import { parseTwee, parseTwineHtml, type TwinePassage } from "@/lib/twine/parser";

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

interface ImportNodePayload {
  source_name: string;
  type: "decision" | "canon" | "simulation";
  summary: string;
  confidence: number;
  has_paradox: boolean;
  structural_pattern: string;
}

interface ImportEdgePayload {
  from_name: string;
  to_name: string;
  label: string;
  order: number;
}

function passagesToPayload(passages: TwinePassage[]): {
  nodes: ImportNodePayload[];
  edges: ImportEdgePayload[];
} {
  const nameSet = new Set(passages.map((p) => p.name));
  const nodes: ImportNodePayload[] = passages.map((p) => ({
    source_name: p.name,
    type: p.tags.includes("canon")
      ? "canon"
      : p.tags.includes("decision")
        ? "decision"
        : "simulation",
    summary: p.content.slice(0, 500),
    confidence: 1.0,
    has_paradox: p.tags.includes("paradox"),
    structural_pattern: "",
  }));

  const edges: ImportEdgePayload[] = [];
  passages.forEach((p) => {
    p.links.forEach((l, j) => {
      if (!nameSet.has(l.target)) return;
      edges.push({
        from_name: p.name,
        to_name: l.target,
        label: l.label,
        order: j,
      });
    });
  });
  return { nodes, edges };
}

export async function POST(req: NextRequest) {
  let context;
  try {
    context = await requireRequestContext(req);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Authentication required";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data body" },
      { status: 400 },
    );
  }

  const file = form.get("file");
  const storyTitle = form.get("storyTitle");
  if (!(file instanceof File) || typeof storyTitle !== "string") {
    return NextResponse.json(
      { error: "file (File) and storyTitle (string) are required" },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: `Twine file is too large (${file.size} bytes); limit is ${MAX_BYTES} bytes (25 MB).`,
      },
      { status: 413 },
    );
  }

  const text = await file.text();

  let passages: TwinePassage[];
  try {
    passages = text.trimStart().startsWith("<!DOCTYPE")
      ? parseTwineHtml(text)
      : parseTwee(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Parse failed: ${msg}` }, { status: 422 });
  }

  if (passages.length === 0) {
    return NextResponse.json(
      { error: "No passages found in file" },
      { status: 422 },
    );
  }

  const { nodes, edges } = passagesToPayload(passages);

  try {
    const upstream = await fetchContextEngine(
      context.tenantId,
      "/api/agent/import/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          story_title: storyTitle,
          nodes,
          edges,
        }),
      },
    );

    const data = (await upstream.json().catch(() => null)) as
      | { story_uid?: string }
      | { error?: string }
      | null;

    if (!upstream.ok) {
      return NextResponse.json(data ?? { error: "Import failed" }, {
        status: upstream.status,
      });
    }

    const storyUid =
      data && "story_uid" in data ? data.story_uid : undefined;
    return NextResponse.json({ storyUid }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Backend unavailable" },
      { status: 502 },
    );
  }
}
