import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * POST /api/admin/upload — Upload a script/document to the knowledge graph.
 *
 * Body: { title, text, source_type, source_url? }
 *
 * 1. Chunks the text into paragraphs/scenes (split on double newlines).
 * 2. Creates a SourceNode via the Django backend.
 * 3. Creates InstanceNodes for each chunk.
 * 4. Falls back to local processing if the backend is unavailable.
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

  const { title, text, source_type, source_url } = body as {
    title?: string;
    text?: string;
    source_type?: string;
    source_url?: string;
  };

  if (!title || !text) {
    return NextResponse.json(
      { error: "title and text are required" },
      { status: 400 },
    );
  }

  // Chunk text into paragraphs / scenes
  const chunks = text
    .split(/\n{2,}/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (chunks.length === 0) {
    return NextResponse.json(
      { error: "Text produced no chunks after splitting" },
      { status: 400 },
    );
  }

  // Try backend first
  try {
    // 1. Create SourceNode
    const sourceRes = await fetch(`${BACKEND_URL}/api/graph/sources/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        source_type: source_type || "other",
        source_url: source_url || null,
        chunk_count: chunks.length,
        word_count: text.split(/\s+/).filter(Boolean).length,
      }),
    });

    if (!sourceRes.ok) {
      const errText = await sourceRes.text();
      throw new Error(`Source creation failed: ${errText}`);
    }

    const sourceData = await sourceRes.json();
    const sourceId = sourceData.id || sourceData.uid;

    // 2. Create InstanceNodes for each chunk
    let createdCount = 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const instanceRes = await fetch(
        `${BACKEND_URL}/api/graph/instances/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_id: sourceId,
            text: chunk,
            sequence_index: i,
            word_count: chunk.split(/\s+/).filter(Boolean).length,
          }),
        },
      );
      if (instanceRes.ok) createdCount++;
    }

    return NextResponse.json({
      success: true,
      source_id: sourceId,
      instance_count: createdCount,
      total_chunks: chunks.length,
    });
  } catch {
    // Backend not available — fall back to local processing
    // Return the chunked data so the client knows what would be created
    return NextResponse.json({
      success: true,
      source: "local_fallback",
      message:
        "Backend not reachable. Chunks processed locally but not persisted to graph.",
      title,
      source_type: source_type || "other",
      instance_count: chunks.length,
      total_chunks: chunks.length,
      chunks: chunks.map((c, i) => ({
        index: i,
        word_count: c.split(/\s+/).filter(Boolean).length,
        preview: c.length > 120 ? c.slice(0, 120) + "..." : c,
      })),
    });
  }
}
