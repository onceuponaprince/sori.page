"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { STORY_BEATS, GENRES } from "@/lib/narrative-concepts";
import { buildRelationalBeatPlan } from "@/lib/relational-beats";
import { useStream } from "@/lib/use-stream";

export default function GeneratePage() {
  const [genre, setGenre] = useState("");
  const [beatId, setBeatId] = useState("");
  const [context, setContext] = useState("");
  const {
    analysis,
    latestStatus,
    loading,
    error,
    generate,
  } = useStream("/api/analyze");

  function handleGenerate() {
    if (!genre || !beatId) return;
    generate({
      title: "Relational Beat Studio",
      outline: context,
    });
  }

  const selectedBeat = STORY_BEATS.find((b) => b.id === beatId);
  const beatPlan = useMemo(
    () =>
      genre && beatId
        ? buildRelationalBeatPlan({
            beatId,
            genreId: genre as (typeof GENRES)[number]["id"],
            context,
            analysis,
          })
        : null,
    [analysis, beatId, context, genre],
  );

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-10">
      <div className="mb-8">
        <p className="sori-kicker text-xs">relational beat studio</p>
        <h1 className="sori-title mb-2 mt-2 text-3xl">Relational Beat Tool</h1>
        <p className="text-[var(--sori-text-secondary)]">
          Pick a genre and a structural moment. Instead of prose, you&apos;ll get
          the beat&apos;s function, the pressure it should create, and why it matters
          to the next movement of the story.
        </p>
      </div>

      <div className="grid md:grid-cols-[380px,1fr] gap-8">
        <div className="sori-panel space-y-6 rounded-2xl p-5 md:p-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Genre</label>
            <div className="grid grid-cols-2 gap-2">
              {GENRES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGenre(g.id)}
                  className={`px-3 py-2 rounded-lg text-sm text-left transition-all border ${
                    genre === g.id
                      ? "bg-primary text-primary-foreground border-primary shadow-[0_3px_0_hsl(14_55%_42%)]"
                      : "bg-background/70 hover:bg-secondary border-border"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Story Beat</label>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {STORY_BEATS.map((beat) => (
                <button
                  key={beat.id}
                  onClick={() => setBeatId(beat.id)}
                  className={`w-full px-3 py-2.5 rounded-lg text-sm text-left transition-all border ${
                    beatId === beat.id
                      ? "bg-primary text-primary-foreground border-primary shadow-[0_3px_0_hsl(14_55%_42%)]"
                      : "bg-background/70 hover:bg-secondary border-border"
                  }`}
                >
                  <span className="font-medium">{beat.name}</span>
                  <span className="block text-xs opacity-70 mt-0.5">
                    {beat.act.replace("_", " ")}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Your Story Context{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Paste a short outline or scene summary if you want the analyzer to connect this beat to your current arc."
              className="min-h-[140px]"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!genre || !beatId || loading || context.trim().length < 40}
            className="w-full"
            size="lg"
          >
            {loading ? statusCopy(latestStatus) : "Connect beat to your story"}
          </Button>
        </div>

        <div className="space-y-6">
          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {beatPlan && (
            <>
              <div className="sori-paper rounded-[1.6rem] p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="sori-chip rounded-full px-3 py-1">
                    {beatPlan.userLabel}
                  </span>
                  <span className="sori-chip rounded-full px-3 py-1">
                    {beatPlan.engineType}
                  </span>
                </div>
                <h2 className="mt-4 text-3xl">{beatPlan.beatName}</h2>
                <p className="mt-3 text-[var(--sori-text-secondary)]">
                  {beatPlan.functionSummary}
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <BeatCard title="Why this beat belongs here" body={beatPlan.whyNow} />
                <BeatCard title="How it pays forward" body={beatPlan.payoffPath} />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="sori-panel rounded-[1.4rem] p-5">
                  <p className="sori-kicker text-xs">structural links</p>
                  <div className="mt-4 space-y-3">
                    <ChainItem
                      label="Before"
                      value={beatPlan.beforeBeat || "This is the baseline calibration point."}
                    />
                    <ChainItem label="Current" value={beatPlan.beatName} />
                    <ChainItem
                      label="After"
                      value={beatPlan.afterBeat || "This beat is already operating as payoff."}
                    />
                  </div>
                </div>

                <div className="sori-panel rounded-[1.4rem] p-5">
                  <p className="sori-kicker text-xs">cross-genre angle</p>
                  <p className="mt-4 text-sm text-[var(--sori-text-secondary)]">
                    {beatPlan.crossGenreAngle}
                  </p>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="sori-panel rounded-[1.4rem] p-5">
                  <p className="sori-kicker text-xs">tension questions</p>
                  <div className="mt-4 space-y-3">
                    {beatPlan.tensionQuestions.map((question, index) => (
                      <div
                        key={`${question}-${index}`}
                        className="rounded-[1rem] border border-border/65 bg-background/45 p-3 text-sm text-[var(--sori-text-secondary)]"
                      >
                        {question}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sori-panel rounded-[1.4rem] p-5">
                  <p className="sori-kicker text-xs">approach b translation</p>
                  <div className="mt-4 space-y-3">
                    {beatPlan.structuralSignals.map((signal, index) => (
                      <div
                        key={`${signal}-${index}`}
                        className="rounded-[1rem] border border-border/65 bg-background/45 p-3 text-sm text-[var(--sori-text-secondary)]"
                      >
                        {signal}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {analysis && (
                <div className="sori-paper rounded-[1.5rem] p-5">
                  <p className="sori-kicker text-xs">linked analyzer context</p>
                  <h3 className="mt-3 text-2xl">{analysis.currentArc}</h3>
                  <p className="mt-3 text-sm text-[var(--sori-text-secondary)]">
                    {analysis.summary}
                  </p>
                </div>
              )}
            </>
          )}

          {!beatPlan && !loading && !error && (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border text-[var(--sori-text-secondary)]">
              <p className="text-center max-w-xs">
                Select a genre and structural beat. This tool will map why that
                beat matters, what it should unlock next, and how to keep it tied
                to your wider story logic.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BeatCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="sori-panel rounded-[1.4rem] p-5">
      <p className="sori-kicker text-xs">{title}</p>
      <p className="mt-4 text-sm text-[var(--sori-text-secondary)]">{body}</p>
    </div>
  );
}

function ChainItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-border/65 bg-background/45 p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--sori-text-muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm text-[var(--sori-text-secondary)]">{value}</p>
    </div>
  );
}

function statusCopy(status: string) {
  switch (status) {
    case "reading-outline":
      return "Reading story";
    case "searching-knowledge-graph":
      return "Mapping beat";
    case "comparing-masterworks":
      return "Comparing structure";
    case "checking-knowledge-flow":
      return "Tracing payoff";
    default:
      return "Connecting...";
  }
}
