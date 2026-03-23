"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ANALYZER_DEMOS } from "@/lib/analyzer-demos";
import { useStream } from "@/lib/use-stream";

export default function DiscoverPage() {
  const [selectedDemoId, setSelectedDemoId] = useState(ANALYZER_DEMOS[0].id);
  const [outline, setOutline] = useState(ANALYZER_DEMOS[0].outline);
  const [title, setTitle] = useState("Stories Like Yours");
  const { analysis, loading, error, latestStatus, generate } =
    useStream("/api/analyze");

  useEffect(() => {
    generate({ demo_id: selectedDemoId });
  }, [generate, selectedDemoId]);

  const demo = useMemo(
    () => ANALYZER_DEMOS.find((item) => item.id === selectedDemoId) ?? ANALYZER_DEMOS[0],
    [selectedDemoId],
  );

  useEffect(() => {
    setOutline(demo.outline);
  }, [demo.outline]);

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-10">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="sori-kicker">discovery engine</p>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 500 }} className="mt-2 text-foreground">
            Stories Like Yours
          </h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "#8A857E", lineHeight: 1.7 }} className="mt-3 max-w-2xl">
            Structural matching across genres. Compare your outline to stories
            that share emotional logic, payoff shape, or moral pressure instead
            of just tags and metadata.
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => generate({ outline, title })}
          disabled={outline.trim().length < 40 || loading}
        >
          {loading ? statusCopy(latestStatus) : "Run live discovery"}
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
        <section className="border border-border bg-card p-5">
          <p className="sori-kicker">demo library</p>
          <div className="mt-4 space-y-3">
            {ANALYZER_DEMOS.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedDemoId(item.id)}
                className={`w-full border p-4 text-left transition-colors cursor-pointer ${
                  selectedDemoId === item.id
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-foreground"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", fontWeight: 500 }}>
                    {item.label}
                  </h2>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase" }} className="opacity-70">
                    {item.genre}
                  </span>
                </div>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem" }} className="mt-2 opacity-80">
                  Use this as a structural comparison starting point.
                </p>
              </button>
            ))}
          </div>

          <div className="mt-5 border border-border p-4">
            <p className="sori-kicker">paste your own outline</p>
            <Textarea
              value={outline}
              onChange={(event) => setOutline(event.target.value)}
              className="mt-3 min-h-[260px]"
              placeholder="Paste a story outline to compare it against structurally similar works..."
            />
          </div>
        </section>

        <section className="space-y-5">
          {error && (
            <div className="border border-accent/30 bg-accent/10 p-4 text-sm text-accent">
              {error}
            </div>
          )}

          {analysis ? (
            <>
              <div className="border border-border bg-card p-6">
                <div className="flex flex-wrap gap-2">
                  <span className="sori-chip px-3 py-1">
                    {analysis.confidenceLabel}
                  </span>
                  <span className="sori-chip px-3 py-1">
                    {analysis.currentArc}
                  </span>
                </div>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 500 }} className="mt-4 text-foreground">
                  {analysis.title}
                </h2>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "#8A857E", lineHeight: 1.7 }} className="mt-3">
                  {analysis.summary}
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <DiscoveryColumn
                  title="Cross-genre resonance"
                  items={analysis.crossGenreComparisons.map((story) => ({
                    title: story.title,
                    meta: story.medium,
                    description: story.resonance,
                    aside: story.takeaway,
                  }))}
                />
                <DiscoveryColumn
                  title="More stories like yours"
                  items={analysis.similarStories.map((story) => ({
                    title: story.title,
                    meta: story.medium,
                    description: story.resonance,
                    aside: story.takeaway,
                  }))}
                />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <DiscoveryColumn
                  title="Pattern matches"
                  items={analysis.patternMatches.map((match) => ({
                    title: match.label,
                    meta: `${Math.round(match.confidence * 100)}%`,
                    description: match.whyItFits,
                    aside:
                      match.depthScore != null
                        ? `Depth score ${match.depthScore}`
                        : "Graph match",
                  }))}
                />
                <DiscoveryColumn
                  title="Questions to deepen it"
                  items={analysis.gentleQuestions.map((question) => ({
                    title: "Gentle prompt",
                    meta: "",
                    description: question.prompt,
                    aside: "",
                  }))}
                />
              </div>
            </>
          ) : (
            <div className="border border-border bg-card p-6">
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "#8A857E", lineHeight: 1.7 }}>
                Choose a demo or paste an outline to see how the discovery engine
                compares structural DNA across genres.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DiscoveryColumn({
  title,
  items,
}: {
  title: string;
  items: { title: string; meta: string; description: string; aside: string }[];
}) {
  return (
    <div className="border border-border bg-card p-5">
      <p className="sori-kicker">{title}</p>
      <div className="mt-4 space-y-3">
        {items.map((item, index) => (
          <div
            key={`${item.title}-${index}`}
            className="border border-border p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", fontWeight: 500 }} className="text-foreground">
                {item.title}
              </h3>
              {item.meta && (
                <span style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A857E" }}>
                  {item.meta}
                </span>
              )}
            </div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E", lineHeight: 1.6 }} className="mt-2">
              {item.description}
            </p>
            {item.aside && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.68rem", color: "#8A857E" }} className="mt-2">
                {item.aside}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function statusCopy(status: string) {
  switch (status) {
    case "reading-outline":
      return "Reading outline";
    case "searching-knowledge-graph":
      return "Searching graph";
    case "comparing-masterworks":
      return "Comparing stories";
    case "checking-knowledge-flow":
      return "Checking structure";
    default:
      return "Discovering...";
  }
}
