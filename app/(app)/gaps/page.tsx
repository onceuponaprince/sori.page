/**
 * Gap Queue — GitHub-issues-style view of knowledge gaps.
 *
 * Gaps are detected when the retrieval layer falls back to RAG because
 * the graph couldn't answer. Displayed with importance scores, blocking
 * relationships, and estimated complexity. Contributors browse and claim
 * gaps to work on.
 */
export default function GapsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <h2 className="text-2xl font-bold">Knowledge Gaps</h2>
      <p className="text-muted-foreground max-w-md text-center">
        Gaps the knowledge graph can&apos;t answer yet. Sorted by importance —
        claim one and help the graph grow.
      </p>
    </div>
  );
}
