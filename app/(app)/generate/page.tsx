"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { STORY_BEATS, GENRES } from "@/lib/narrative-concepts";
import { useStream } from "@/lib/use-stream";

export default function GeneratePage() {
  const [genre, setGenre] = useState("");
  const [beatId, setBeatId] = useState("");
  const [context, setContext] = useState("");
  const {
    mainContent,
    structuralNotes,
    metadata,
    loading,
    error,
    done,
    generate,
  } = useStream("/api/generate/beat");

  function handleGenerate() {
    if (!genre || !beatId) return;
    generate({ genre, beat_id: beatId, context });
  }

  const selectedBeat = STORY_BEATS.find((b) => b.id === beatId);
  const hasContent = mainContent.length > 0;

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Story Beat Generator</h1>
        <p className="text-muted-foreground">
          Pick a genre and a structural moment. Get a scene grounded in
          narrative concepts — with the reasoning visible.
        </p>
      </div>

      <div className="grid md:grid-cols-[380px,1fr] gap-8">
        {/* Controls */}
        <div className="space-y-6">
          {/* Genre selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Genre</label>
            <div className="grid grid-cols-2 gap-2">
              {GENRES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGenre(g.id)}
                  className={`px-3 py-2 rounded-lg text-sm text-left transition-all border ${
                    genre === g.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-input"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          {/* Beat selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Story Beat</label>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {STORY_BEATS.map((beat) => (
                <button
                  key={beat.id}
                  onClick={() => setBeatId(beat.id)}
                  className={`w-full px-3 py-2.5 rounded-lg text-sm text-left transition-all border ${
                    beatId === beat.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-input"
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

          {/* Optional context */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Your Context{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Describe your story, characters, or specific scenario..."
              className="min-h-[80px]"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!genre || !beatId || loading}
            className="w-full"
            size="lg"
          >
            {loading ? "Generating..." : "Generate Scene"}
          </Button>
        </div>

        {/* Output — streams in real time */}
        <div className="space-y-6">
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
              {error}
            </div>
          )}

          {hasContent && (
            <>
              {/* Scene output — streams word by word */}
              <div className="border rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="font-semibold text-lg">Generated Scene</h2>
                  {selectedBeat && (
                    <span className="text-xs bg-muted px-2 py-1 rounded-md">
                      {selectedBeat.name}
                    </span>
                  )}
                  {loading && (
                    <span className="text-xs text-muted-foreground animate-pulse">
                      streaming...
                    </span>
                  )}
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {mainContent}
                  {loading && <span className="animate-pulse">|</span>}
                </div>
              </div>

              {/* Structural notes — appear after marker is streamed */}
              {structuralNotes && (
                <div className="border border-dashed rounded-xl p-6 bg-muted/30">
                  <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
                    Structural Notes
                  </h3>
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-muted-foreground">
                    {structuralNotes}
                    {loading && <span className="animate-pulse">|</span>}
                  </div>
                </div>
              )}

              {/* Concept provenance — shows immediately from metadata */}
              {metadata && (
                <div className="border rounded-xl p-4">
                  <h3 className="font-semibold mb-2 text-sm uppercase tracking-wide text-muted-foreground">
                    Concepts Used
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(
                      (metadata.concepts_used as string[]) || []
                    ).map((concept, i) => (
                      <span
                        key={i}
                        className="text-xs bg-muted px-2 py-1 rounded-md"
                      >
                        {concept.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!hasContent && !loading && !error && (
            <div className="flex items-center justify-center h-64 text-muted-foreground border border-dashed rounded-xl">
              <p className="text-center max-w-xs">
                Select a genre and story beat, then generate. You&apos;ll see
                the scene and the structural reasoning behind it.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
