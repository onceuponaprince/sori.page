/**
 * sori.page — Architect Mode (v1)
 *
 * This is the Twine-like canvas where users see their story's structural
 * scaffold as an interactive graph. React Flow renders SceneNodes as
 * draggable nodes and NarrativeEdges as connections between them.
 *
 * For v1: Displays agent-generated scaffolds, click for scene briefs.
 * For v2: Each node opens into a Notion-like rich text editor.
 */
export default function ArchitectPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
      <div className="text-center max-w-lg">
        <h1 className="text-3xl font-bold tracking-tight mb-3">
          sori<span className="text-muted-foreground">.page</span>
        </h1>
        <p className="text-muted-foreground text-lg mb-6">
          AI context engine for writers. Structure your story with verified
          narrative knowledge, not statistical guesswork.
        </p>
        <div className="bg-muted/50 rounded-lg p-6 text-left text-sm space-y-3">
          <p>
            <strong>Architect Mode</strong> — The canvas where your story&apos;s
            structural scaffold lives. React Flow integration coming next.
          </p>
          <p className="text-muted-foreground">
            Backend services: Neo4j (knowledge graph), Weaviate (RAG),
            Django (API). Connect them with{" "}
            <code className="bg-muted px-1 rounded">docker compose up</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
