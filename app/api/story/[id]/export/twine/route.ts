/**
 * GET /api/story/[id]/export/twine
 *
 * Streams a Twine 2 HTML file representing the full multiverse tree
 * for a story. The user clicks the "Export to Twine" link in the
 * timeline header; this route handles auth, fetches the canonical
 * tree from the engine, transforms it into TwinePassage[], and
 * builds the final HTML in memory.
 *
 * Tenant routing is preserved via fetchContextEngine.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchContextEngine } from "@/lib/context-engine-gateway";
import { requireRequestContext } from "@/lib/request-context";
import { buildTwineHtml } from "@/lib/twine/exporter";
import type { TwinePassage } from "@/lib/twine/parser";

export const runtime = "nodejs";

interface EngineNode {
  id: string;
  type: "simulation" | "decision" | "canon";
  sceneGoal: string;
  metadata?: {
    isParadox?: boolean;
    structuralPattern?: string | null;
  };
  choices?: Array<{
    id: string;
    label: string;
    targetNodeId: string;
    intent: string;
  }>;
}

interface EngineTree {
  rootNodeId: string | null;
  nodes: Record<string, EngineNode>;
}

function nodeToPassage(node: EngineNode): TwinePassage {
  // Preserve the node's logical type on round-trip via tags. The
  // import route reads these to reconstruct node_type — without the
  // `decision` tag, decision nodes would degrade to `simulation` on
  // re-import.
  const tags: string[] = [];
  if (node.type === "canon") tags.push("canon");
  else if (node.type === "decision") tags.push("decision");
  else tags.push("explored");
  if (node.metadata?.isParadox) tags.push("paradox");
  if (node.metadata?.structuralPattern) {
    tags.push(node.metadata.structuralPattern.toLowerCase());
  }

  const links =
    (node.choices ?? [])
      .filter((c) => Boolean(c.targetNodeId))
      .map((c) => ({ label: c.label, target: c.targetNodeId }));

  return {
    name: node.id,
    tags,
    content: node.sceneGoal,
    links,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: storyUid } = await params;
  try {
    const context = await requireRequestContext(req);
    const upstream = await fetchContextEngine(
      context.tenantId,
      `/api/agent/multiverse/${storyUid}/`,
      { method: "GET", cache: "no-store" },
    );

    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Story not found" },
        { status: upstream.status === 404 ? 404 : 502 },
      );
    }

    const tree = (await upstream.json()) as EngineTree;
    if (!tree.nodes || Object.keys(tree.nodes).length === 0) {
      return NextResponse.json(
        { error: "Story has no multiverse nodes" },
        { status: 400 },
      );
    }

    const passages = Object.values(tree.nodes).map(nodeToPassage);
    const html = buildTwineHtml(`sori-story-${storyUid}`, passages);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="story-${storyUid}.html"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    const isAuth =
      message === "Authentication required" ||
      message === "Invalid auth token" ||
      message === "Tenant access denied";
    return NextResponse.json(
      { error: isAuth ? message : "Export failed" },
      { status: isAuth ? 401 : 500 },
    );
  }
}
