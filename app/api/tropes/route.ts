import { NextRequest, NextResponse } from "next/server";

/**
 * Trope search API — queries the Django backend's Neo4j graph
 * for relevant narrative concepts.
 *
 * For MVP: falls back to the seeded narrative concepts if the
 * backend isn't running.
 *
 * Usage: GET /api/tropes?q=mentor+death&limit=5
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const limit = parseInt(searchParams.get("limit") || "10");

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  try {
    // Try the Django backend first (connected to Neo4j)
    const res = await fetch(
      `${backendUrl}/api/graph/concepts/search/?q=${encodeURIComponent(query)}&limit=${limit}`,
      { next: { revalidate: 60 } }, // Cache for 60 seconds
    );

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch {
    // Backend not available — fall through to local data
  }

  // Fallback: search the seeded narrative concepts
  const { STORY_BEATS, CHARACTER_ARCHETYPES } = await import(
    "@/lib/narrative-concepts"
  );

  const lowerQuery = query.toLowerCase();
  const results = [
    ...STORY_BEATS.filter(
      (b) =>
        b.name.toLowerCase().includes(lowerQuery) ||
        b.description.toLowerCase().includes(lowerQuery) ||
        b.typical_tropes.some((t) => t.includes(lowerQuery)),
    ).map((b) => ({
      type: "beat",
      name: b.name,
      description: b.description,
      depth_score: 1,
      confidence: 1.0,
    })),
    ...CHARACTER_ARCHETYPES.filter(
      (a) =>
        a.name.toLowerCase().includes(lowerQuery) ||
        a.description.toLowerCase().includes(lowerQuery),
    ).map((a) => ({
      type: "archetype",
      name: a.name,
      description: a.description,
      depth_score: 1,
      confidence: 1.0,
    })),
  ].slice(0, limit);

  return NextResponse.json({
    results,
    source: "local_seed", // Tells the frontend this isn't from the graph yet
  });
}
