/**
 * Contributor Interface — where humans review algorithm-proposed clusters,
 * formalize concept nodes, and participate in quorum consensus.
 *
 * V1: Review queue, five manipulation actions (accept, split, merge, promote, reject),
 * branch management, atomic commits.
 */
export default function ContributePage() {
  return (
    <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-center p-8">
      <div className="sori-paper w-full rounded-3xl p-10 text-center">
        <p className="sori-kicker text-xs">contributors</p>
        <h2 className="sori-title mt-2 text-4xl">Contributor Dashboard</h2>
        <p className="mx-auto mt-4 max-w-xl text-[var(--sori-text-secondary)]">
          Review proposed concept clusters, formalize knowledge nodes, and
          participate in consensus. The knowledge graph grows through your
          expertise.
        </p>
      </div>
    </div>
  );
}
