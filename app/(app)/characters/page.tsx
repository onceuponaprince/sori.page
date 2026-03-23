"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CHARACTER_ARCHETYPES,
  GENRES,
  TEMPLATE_SCENES,
} from "@/lib/narrative-concepts";
import { useStream } from "@/lib/use-stream";

export default function CharactersPage() {
  const [archetypeId, setArchetypeId] = useState("");
  const [genre, setGenre] = useState("");
  const [traits, setTraits] = useState("");
  const [sceneId, setSceneId] = useState("");
  const {
    mainContent,
    structuralNotes,
    metadata,
    loading,
    error,
    generate,
  } = useStream("/api/generate/character");

  const availableScenes = TEMPLATE_SCENES.filter(
    (s) =>
      (!genre || s.genre === genre) &&
      (!archetypeId ||
        s.character_slots.some((slot) => slot.archetype === archetypeId)),
  );

  function handleGenerate() {
    if (!archetypeId || !genre) return;
    generate({
      archetype_id: archetypeId,
      genre,
      traits,
      scene_id: sceneId || undefined,
    });
  }

  const selectedArchetype = CHARACTER_ARCHETYPES.find(
    (a) => a.id === archetypeId,
  );
  const hasContent = mainContent.length > 0;

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-10">
      <div className="mb-8">
        <p className="sori-kicker text-xs">generator</p>
        <h1 className="sori-title mb-2 mt-2 text-3xl">Character Generator</h1>
        <p className="text-[var(--sori-text-secondary)]">
          Create characters grounded in narrative archetypes. Optionally insert
          them into iconic template scenes to test how they work.
        </p>
      </div>

      <div className="grid md:grid-cols-[380px,1fr] gap-8">
        {/* Controls */}
        <div className="sori-panel space-y-6 rounded-2xl p-5 md:p-6">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Character Archetype
            </label>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {CHARACTER_ARCHETYPES.map((arch) => (
                <button
                  key={arch.id}
                  onClick={() => {
                    setArchetypeId(arch.id);
                    setSceneId("");
                  }}
                  className={`w-full px-3 py-2.5 rounded-lg text-sm text-left transition-all border ${
                    archetypeId === arch.id
                      ? "bg-primary text-primary-foreground border-primary shadow-[0_3px_0_hsl(14_55%_42%)]"
                      : "bg-background/70 hover:bg-secondary border-border"
                  }`}
                >
                  <span className="font-medium">{arch.name}</span>
                  <span className="block text-xs opacity-70 mt-0.5 line-clamp-1">
                    {arch.narrative_function}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Genre</label>
            <div className="grid grid-cols-2 gap-2">
              {GENRES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    setGenre(g.id);
                    setSceneId("");
                  }}
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

          {availableScenes.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                Insert into Scene{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <div className="space-y-1.5">
                {availableScenes.map((scene) => (
                  <button
                    key={scene.id}
                    onClick={() =>
                      setSceneId(sceneId === scene.id ? "" : scene.id)
                    }
                    className={`w-full px-3 py-2.5 rounded-lg text-sm text-left transition-all border ${
                      sceneId === scene.id
                        ? "bg-primary text-primary-foreground border-primary shadow-[0_3px_0_hsl(14_55%_42%)]"
                        : "bg-background/70 hover:bg-secondary border-border"
                    }`}
                  >
                    <span className="font-medium">{scene.scene_name}</span>
                    <span className="block text-xs opacity-70 mt-0.5">
                      {scene.work}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-2 block">
              Custom Traits{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              value={traits}
              onChange={(e) => setTraits(e.target.value)}
              placeholder="Describe specific traits, backstory elements, or constraints..."
              className="min-h-[80px]"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!archetypeId || !genre || loading}
            className="w-full"
            size="lg"
          >
            {loading ? "Generating..." : "Generate Character"}
          </Button>
        </div>

        {/* Output — streams in real time */}
        <div className="space-y-6">
          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {hasContent && (
            <>
              <div className="sori-panel rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="font-semibold text-lg">Character Profile</h2>
                  {selectedArchetype && (
                    <span className="sori-chip rounded-md px-2 py-1 text-xs">
                      {selectedArchetype.name}
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

              {structuralNotes && (
                <div className="rounded-xl border border-dashed border-border p-6 bg-secondary/45">
                  <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
                    Structural Notes
                  </h3>
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-muted-foreground">
                    {structuralNotes}
                    {loading && <span className="animate-pulse">|</span>}
                  </div>
                </div>
              )}

              {metadata && (
                <div className="sori-panel rounded-xl p-4">
                  <h3 className="font-semibold mb-2 text-sm uppercase tracking-wide text-muted-foreground">
                    Concepts Used
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {((metadata.concepts_used as string[]) || []).map(
                      (concept, i) => (
                        <span
                          key={i}
                          className="sori-chip rounded-md px-2 py-1 text-xs"
                        >
                          {concept.replace(/_/g, " ")}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {!hasContent && !loading && !error && (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border text-[var(--sori-text-secondary)]">
              <p className="text-center max-w-xs">
                Select an archetype and genre. Optionally choose a template
                scene to see your character in action.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
