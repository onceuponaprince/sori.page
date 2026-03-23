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
    <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-center p-8">
      <div className="sori-paper w-full rounded-3xl p-10 text-center">
        <p className="sori-kicker text-xs">graph coverage</p>
        <h2 className="sori-title mt-2 text-4xl">Knowledge Gaps</h2>
        <p className="mx-auto mt-4 max-w-xl text-[var(--sori-text-secondary)]">
          Gaps the knowledge graph can&apos;t answer yet. Sorted by importance —
          claim one and help the graph grow.
        </p>
      </div>
    </div>
  );
}
