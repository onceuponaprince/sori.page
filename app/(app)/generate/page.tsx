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
        <p className="sori-kicker">relational beat studio</p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 500 }} className="mb-2 mt-2 text-foreground">
          Relational Beat Tool
        </h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "#8A857E", lineHeight: 1.7 }}>
          Pick a genre and a structural moment. Instead of prose, you&apos;ll get
          the beat&apos;s function, the pressure it should create, and why it matters
          to the next movement of the story.
        </p>
      </div>

      <div className="grid md:grid-cols-[380px,1fr] gap-8">
        <div className="border border-border bg-card space-y-6 p-5 md:p-6">
          <div>
            <label style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", fontWeight: 500 }} className="mb-2 block">Genre</label>
            <div className="grid grid-cols-2 gap-2">
              {GENRES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGenre(g.id)}
                  style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem" }}
                  className={`px-3 py-2 text-left transition-colors border cursor-pointer ${
                    genre === g.id
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent hover:border-foreground border-border"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", fontWeight: 500 }} className="mb-2 block">Story Beat</label>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {STORY_BEATS.map((beat) => (
                <button
                  key={beat.id}
                  onClick={() => setBeatId(beat.id)}
                  style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem" }}
                  className={`w-full px-3 py-2.5 text-left transition-colors border cursor-pointer ${
                    beatId === beat.id
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent hover:border-foreground border-border"
                  }`}
                >
                  <span className="font-medium">{beat.name}</span>
                  <span style={{ fontSize: "0.68rem" }} className="block opacity-70 mt-0.5">
                    {beat.act.replace("_", " ")}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", fontWeight: 500 }} className="mb-2 block">
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
            <div className="border border-accent/40 bg-accent/10 p-4 text-sm text-accent">
              {error}
            </div>
          )}

          {beatPlan && (
            <>
              <div className="border border-border bg-card p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="sori-chip px-3 py-1">
                    {beatPlan.userLabel}
                  </span>
                  <span className="sori-chip px-3 py-1">
                    {beatPlan.engineType}
                  </span>
                </div>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 500 }} className="mt-4 text-foreground">
                  {beatPlan.beatName}
                </h2>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "#8A857E", lineHeight: 1.7 }} className="mt-3">
                  {beatPlan.functionSummary}
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <BeatCard title="Why this beat belongs here" body={beatPlan.whyNow} />
                <BeatCard title="How it pays forward" body={beatPlan.payoffPath} />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="border border-border bg-card p-5">
                  <p className="sori-kicker">structural links</p>
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

                <div className="border border-border bg-card p-5">
                  <p className="sori-kicker">cross-genre angle</p>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E", lineHeight: 1.6 }} className="mt-4">
                    {beatPlan.crossGenreAngle}
                  </p>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="border border-border bg-card p-5">
                  <p className="sori-kicker">tension questions</p>
                  <div className="mt-4 space-y-3">
                    {beatPlan.tensionQuestions.map((question, index) => (
                      <div
                        key={`${question}-${index}`}
                        className="border border-border p-3"
                      >
                        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#4A4845" }}>
                          {question}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-border bg-card p-5">
                  <p className="sori-kicker">approach b translation</p>
                  <div className="mt-4 space-y-3">
                    {beatPlan.structuralSignals.map((signal, index) => (
                      <div
                        key={`${signal}-${index}`}
                        className="border border-border p-3"
                      >
                        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#4A4845" }}>
                          {signal}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {analysis && (
                <div className="border border-border bg-card p-5">
                  <p className="sori-kicker">linked analyzer context</p>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 500 }} className="mt-3 text-foreground">
                    {analysis.currentArc}
                  </h3>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E", lineHeight: 1.6 }} className="mt-3">
                    {analysis.summary}
                  </p>
                </div>
              )}
            </>
          )}

          {!beatPlan && !loading && !error && (
            <div className="flex h-64 items-center justify-center border border-dashed border-border">
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "#8A857E" }} className="text-center max-w-xs">
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
    <div className="border border-border bg-card p-5">
      <p className="sori-kicker">{title}</p>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E", lineHeight: 1.6 }} className="mt-4">
        {body}
      </p>
    </div>
  );
}

function ChainItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border p-3">
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A857E" }}>
        {label}
      </p>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#4A4845" }} className="mt-1">
        {value}
      </p>
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
