"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CHARACTER_ARCHETYPES,
  GENRES,
  TEMPLATE_SCENES,
} from "@/lib/narrative-concepts";

export default function CharactersPage() {
  const [archetypeId, setArchetypeId] = useState("");
  const [genre, setGenre] = useState("");
  const [traits, setTraits] = useState("");
  const [sceneId, setSceneId] = useState("");
  const [result, setResult] = useState<{
    profile: string;
    structural_notes: string;
    metadata: Record<string, unknown>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filter template scenes by genre and archetype
  const availableScenes = TEMPLATE_SCENES.filter(
    (s) =>
      (!genre || s.genre === genre) &&
      (!archetypeId ||
        s.character_slots.some((slot) => slot.archetype === archetypeId)),
  );

  async function handleGenerate() {
    if (!archetypeId || !genre) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/generate/character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archetype_id: archetypeId,
          genre,
          traits,
          scene_id: sceneId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Generation failed");
        return;
      }

      setResult(await res.json());
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const selectedArchetype = CHARACTER_ARCHETYPES.find(
    (a) => a.id === archetypeId,
  );

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Character Generator</h1>
        <p className="text-muted-foreground">
          Create characters grounded in narrative archetypes. Optionally insert
          them into iconic template scenes to test how they work.
        </p>
      </div>

      <div className="grid md:grid-cols-[380px,1fr] gap-8">
        {/* Controls */}
        <div className="space-y-6">
          {/* Archetype selection */}
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
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-input"
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

          {/* Genre */}
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
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-input"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          {/* Template scene insertion */}
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
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted border-input"
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

          {/* Custom traits */}
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

        {/* Output */}
        <div className="space-y-6">
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center space-y-3">
                <div className="animate-pulse text-lg">
                  Building character...
                </div>
                <p className="text-sm">
                  Grounding archetype in genre conventions and narrative function
                </p>
              </div>
            </div>
          )}

          {result && (
            <>
              {/* Character profile */}
              <div className="border rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="font-semibold text-lg">Character Profile</h2>
                  {selectedArchetype && (
                    <span className="text-xs bg-muted px-2 py-1 rounded-md">
                      {selectedArchetype.name}
                    </span>
                  )}
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {result.profile}
                </div>
              </div>

              {/* Structural notes */}
              {result.structural_notes && (
                <div className="border border-dashed rounded-xl p-6 bg-muted/30">
                  <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
                    Structural Notes
                  </h3>
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-muted-foreground">
                    {result.structural_notes}
                  </div>
                </div>
              )}

              {/* Concepts */}
              <div className="border rounded-xl p-4">
                <h3 className="font-semibold mb-2 text-sm uppercase tracking-wide text-muted-foreground">
                  Concepts Used
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(
                    (result.metadata?.concepts_used as string[]) || []
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
            </>
          )}

          {!result && !loading && !error && (
            <div className="flex items-center justify-center h-64 text-muted-foreground border border-dashed rounded-xl">
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
