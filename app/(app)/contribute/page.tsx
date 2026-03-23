export default function ContributePage() {
  return (
    <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-center p-8">
      <div className="w-full border border-border bg-card p-10 text-center">
        <p className="sori-kicker">contributors</p>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 500 }} className="mt-2 text-foreground">
          Contributor Dashboard
        </h2>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "#8A857E", lineHeight: 1.7 }} className="mx-auto mt-4 max-w-xl">
          Review proposed concept clusters, formalize knowledge nodes, and
          participate in consensus. The knowledge graph grows through your
          expertise.
        </p>
      </div>
    </div>
  );
}
