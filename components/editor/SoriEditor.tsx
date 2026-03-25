"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { JSONContent } from "@tiptap/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStream } from "@/lib/use-stream";
import { createBrowserClient } from "@/lib/supabase/client";
import type { AnalyzerResult, EpistemicState } from "@/lib/analyzer-types";
import { MultiverseSidebar } from "@/components/multiverse/MultiverseSidebar";

const STORAGE_KEY = "sori-treehouse-draft-v1";

interface StoredDraft {
  storyUid: string;
  sceneUid: string;
  title: string;
  outlineText: string;
  editorJson: JSONContent;
  analysis: AnalyzerResult | null;
}

function createEmptyDocument(text = ""): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: text ? [{ type: "text", text }] : [],
      },
    ],
  };
}

function loadStoredDraft(): StoredDraft {
  if (typeof window === "undefined") {
    return {
      storyUid: crypto.randomUUID(),
      sceneUid: crypto.randomUUID(),
      title: "Untitled Draft",
      outlineText: "",
      editorJson: createEmptyDocument(),
      analysis: null,
    };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      storyUid: crypto.randomUUID(),
      sceneUid: crypto.randomUUID(),
      title: "Untitled Draft",
      outlineText: "",
      editorJson: createEmptyDocument(),
      analysis: null,
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredDraft>;
    return {
      storyUid: parsed.storyUid || crypto.randomUUID(),
      sceneUid: parsed.sceneUid || crypto.randomUUID(),
      title: parsed.title || "Untitled Draft",
      outlineText: parsed.outlineText || "",
      editorJson: parsed.editorJson || createEmptyDocument(parsed.outlineText || ""),
      analysis: parsed.analysis ?? null,
    };
  } catch {
    return {
      storyUid: crypto.randomUUID(),
      sceneUid: crypto.randomUUID(),
      title: "Untitled Draft",
      outlineText: "",
      editorJson: createEmptyDocument(),
      analysis: null,
    };
  }
}

export function SoriEditor() {
  const initialDraft = useMemo(loadStoredDraft, []);
  const [mounted, setMounted] = useState(false);
  const [storyUid] = useState(initialDraft.storyUid);
  const [sceneUid] = useState(initialDraft.sceneUid);
  const [title, setTitle] = useState(initialDraft.title);
  const [plainText, setPlainText] = useState(initialDraft.outlineText);
  const [editorJson, setEditorJson] = useState<JSONContent>(initialDraft.editorJson);
  const [savedLabel, setSavedLabel] = useState("Saved locally");
  const [userId, setUserId] = useState<string | null>(null);
  const lastAnalyzedRef = useRef("");
  const [multiverseOpen, setMultiverseOpen] = useState(false);

  const {
    analysis,
    metadata,
    loading,
    error,
    latestStatus,
    generate,
  } = useStream("/api/analyze");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder:
          "Paste an outline, sketch a scene, or map the emotional turns you already know. sori will look for structure, not prose perfection.",
      }),
    ],
    content: initialDraft.editorJson,
    editorProps: {
      attributes: {
        class:
          "prose prose-lg max-w-none min-h-[70dvh] focus:outline-none text-[17px] leading-8 text-foreground",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      setPlainText(currentEditor.getText());
      setEditorJson(currentEditor.getJSON());
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function resolveUser() {
      try {
        const supabase = createBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled) {
          setUserId(user?.id ?? null);
        }
      } catch {
        if (!cancelled) {
          setUserId(null);
        }
      }
    }

    resolveUser();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const snapshot: StoredDraft = {
      storyUid,
      sceneUid,
      title,
      outlineText: plainText,
      editorJson,
      analysis: analysis ?? initialDraft.analysis,
    };

    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    }
  }, [analysis, editorJson, initialDraft.analysis, plainText, sceneUid, storyUid, title]);

  useEffect(() => {
    if (!title.trim() && !plainText.trim()) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      setSavedLabel("Saving...");
      try {
        const response = await fetch("/api/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            story_uid: storyUid,
            scene_uid: sceneUid,
            title,
            outline_text: plainText,
            editor_json: editorJson,
            analyzer_snapshot: analysis ?? {},
            user_id: userId,
          }),
        });

        if (!response.ok) {
          throw new Error("Draft save failed");
        }

        setSavedLabel("Saved");
      } catch {
        setSavedLabel("Saved locally");
      }
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [analysis, editorJson, plainText, sceneUid, storyUid, title, userId]);

  useEffect(() => {
    if (!plainText.trim() || plainText.trim().length < 120) {
      return;
    }

    const timeout = window.setTimeout(() => {
      if (loading || lastAnalyzedRef.current === plainText) {
        return;
      }

      lastAnalyzedRef.current = plainText;
      generate({
        title,
        outline: plainText,
        story_uid: storyUid,
      });
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [generate, loading, plainText, title, storyUid]);

  if (!mounted) {
    return (
      <div className={`grid gap-5 p-4 md:p-6 ${multiverseOpen ? "xl:grid-cols-[minmax(0,1fr)_300px_340px]" : "xl:grid-cols-[minmax(0,1fr)_300px]"}`}>
        <section className="border border-border bg-card p-6">
          <div className="h-[72dvh] border border-border" />
        </section>
        <aside className="space-y-4">
          <div className="border border-border bg-card p-6">
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E" }}>
              Loading editor...
            </p>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className={`grid gap-5 p-4 md:p-6 ${multiverseOpen ? "xl:grid-cols-[minmax(0,1fr)_300px_340px]" : "xl:grid-cols-[minmax(0,1fr)_300px]"}`}>
      <section className="border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <p className="sori-kicker">editor</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="max-w-xl"
                placeholder="Name your draft"
              />
              <div className="flex flex-wrap gap-2">
                <span className="sori-chip px-2.5 py-0.5">
                  {storyUid.slice(0, 8)}
                </span>
                <span className="sori-chip px-2.5 py-0.5">{savedLabel}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                generate({
                  title,
                  outline: plainText,
                  story_uid: storyUid,
                })
              }
              disabled={plainText.trim().length < 40 || loading}
            >
              {loading ? "Reading..." : "Analyze"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMultiverseOpen(!multiverseOpen)}
              className={multiverseOpen ? "border-accent text-accent" : ""}
            >
              {multiverseOpen ? "Close Lab" : "Test"}
            </Button>
          </div>
        </div>

        <div className="mt-5">
          <div className="border border-border bg-card p-5 sm:p-7">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E" }} className="m-0">
                Draft freely. The sidebar will update when the story reveals a
                structural pattern.
              </p>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A857E" }}>
                {plainText.trim().length} chars
              </span>
            </div>
            <EditorContent editor={editor} />
          </div>
        </div>
      </section>

      <StructuralSidebar
        analysis={analysis ?? initialDraft.analysis}
        metadata={metadata}
        latestStatus={latestStatus}
        loading={loading}
        error={error}
      />

      {multiverseOpen && (
        <MultiverseSidebar
          storyUid={storyUid}
          isOpen={multiverseOpen}
          onClose={() => setMultiverseOpen(false)}
          onBeatCreated={(beatId) => {
            setSavedLabel(`Beat ${beatId.slice(0, 8)} created`);
          }}
          availableCharacterIds={
            analysis?.epistemicState?.characters.map((c) => ({
              id: c.name.toLowerCase().replace(/\s+/g, "-"),
              name: c.name,
            })) || []
          }
        />
      )}
    </div>
  );
}

function StructuralSidebar({
  analysis,
  metadata,
  latestStatus,
  loading,
  error,
}: {
  analysis: AnalyzerResult | null;
  metadata: Record<string, unknown> | null;
  latestStatus: string;
  loading: boolean;
  error: string;
}) {
  const readableStatus = statusCopy(latestStatus);
  const metadataCurrentArc =
    typeof metadata?.current_arc === "string" ? metadata.current_arc : "";

  return (
    <aside className="space-y-4">
      <div className="border border-border bg-card p-5">
        <p className="sori-kicker">live sidebar</p>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", fontWeight: 500 }} className="mt-3 text-foreground">
          Structural pulse
        </h2>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E", lineHeight: 1.7 }} className="mt-3">
          This pane stays focused on story logic, comparison, and knowledge flow.
          It never writes the scene for you.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="sori-chip px-2.5 py-0.5">
            {loading ? readableStatus : analysis?.confidenceLabel || "Waiting for structure"}
          </span>
          {metadataCurrentArc && (
            <span className="sori-chip px-2.5 py-0.5">
              {metadataCurrentArc}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="border border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {analysis ? (
        <>
          <SidebarCard title="Summary" body={analysis.summary} />
          <SidebarCard title="Current Arc" body={analysis.currentArc} />

          <div className="border border-border bg-card p-4">
            <p className="sori-kicker">Pattern matches</p>
            <div className="mt-3 space-y-3">
              {analysis.patternMatches.map((match) => (
                <div key={match.id} className="border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", fontWeight: 500 }} className="text-foreground">
                      {match.label}
                    </h3>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "0.68rem", color: "#8A857E" }}>
                      {Math.round(match.confidence * 100)}%
                    </span>
                  </div>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E", lineHeight: 1.6 }} className="mt-2">
                    {match.whyItFits}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border bg-card p-4">
            <p className="sori-kicker">Stories like yours</p>
            <div className="mt-3 space-y-3">
              {analysis.crossGenreComparisons.map((story) => (
                <div key={story.title} className="border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", fontWeight: 500 }} className="text-foreground">
                      {story.title}
                    </h3>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A857E" }}>
                      {story.medium}
                    </span>
                  </div>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E", lineHeight: 1.6 }} className="mt-2">
                    {story.resonance}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <KnowledgeFlowPanel
            epistemicState={analysis.epistemicState}
            timelineWarnings={analysis.timelineWarnings}
          />

          <div className="border border-border bg-card p-4">
            <p className="sori-kicker">Gentle questions</p>
            <div className="mt-3 space-y-3">
              {analysis.gentleQuestions.map((question) => (
                <div key={question.id} className="border border-border p-3 text-sm" style={{ fontFamily: "var(--font-body)", color: "#4A4845" }}>
                  {question.prompt}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="border border-border bg-card p-5">
          <p className="sori-kicker">first pass</p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E", lineHeight: 1.7 }} className="mt-3">
            Once your draft has enough shape, sori will surface likely pattern
            matches, similar stories, and questions about payoff and who knows
            what when.
          </p>
        </div>
      )}
    </aside>
  );
}

function SidebarCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-border bg-card p-4">
      <p className="sori-kicker">{title}</p>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E", lineHeight: 1.7 }} className="mt-3">
        {body}
      </p>
    </div>
  );
}

function KnowledgeFlowPanel({
  epistemicState,
  timelineWarnings,
}: {
  epistemicState?: EpistemicState;
  timelineWarnings: AnalyzerResult["timelineWarnings"];
}) {
  const hasEpistemic =
    epistemicState &&
    (epistemicState.characters.length > 0 ||
      epistemicState.facts.length > 0 ||
      epistemicState.violations.length > 0);

  return (
    <div className="border border-border bg-card p-4">
      <p className="sori-kicker">Knowledge flow</p>

      {hasEpistemic && (
        <>
          {epistemicState.characters.length > 0 && (
            <div className="mt-3">
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A857E" }} className="mb-2 font-medium">
                Characters
              </p>
              <div className="flex flex-wrap gap-1.5">
                {epistemicState.characters.map((char) => (
                  <span
                    key={char.name}
                    className="sori-chip px-2.5 py-0.5 text-xs"
                  >
                    {char.name}
                    {char.roleHint && (
                      <span style={{ color: "#8A857E" }} className="ml-1">
                        ({char.roleHint})
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {epistemicState.facts.length > 0 && (
            <div className="mt-4">
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A857E" }} className="mb-2 font-medium">
                Story facts
              </p>
              <div className="space-y-2">
                {epistemicState.facts.map((fact, idx) => (
                  <div
                    key={`${fact.description.slice(0, 20)}-${idx}`}
                    className="border border-border p-2.5 text-xs"
                  >
                    <p style={{ color: "#4A4845" }}>
                      {fact.description}
                    </p>
                    <p style={{ color: "#8A857E" }} className="mt-1">
                      Introduced at beat {fact.introducedAtBeat}
                      {fact.knownBy.length > 0 && (
                        <span>
                          {" · known by "}
                          {fact.knownBy
                            .map((e) => `${e.character} (beat ${e.beatIndex})`)
                            .join(", ")}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {epistemicState.violations.length > 0 && (
            <div className="mt-4">
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#C8635A" }} className="mb-2 font-medium">
                Unearned knowledge
              </p>
              <div className="space-y-2">
                {epistemicState.violations.map((v, idx) => (
                  <div
                    key={`${v.character}-${v.actsAtBeat}-${idx}`}
                    className="border border-accent/30 bg-accent/5 p-2.5 text-xs"
                  >
                    <p className="font-medium text-accent">
                      {v.character} acts on unearned knowledge at beat{" "}
                      {v.actsAtBeat}
                    </p>
                    <p style={{ color: "#4A4845" }} className="mt-1">
                      &quot;{v.fact}&quot; — the outline does not show {v.character}{" "}
                      learning this before acting on it.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {timelineWarnings.length > 0 && (
        <div className={hasEpistemic ? "mt-4" : "mt-3"}>
          {hasEpistemic && (
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A857E" }} className="mb-2 font-medium">
              Additional checks
            </p>
          )}
          <div className="space-y-2">
            {timelineWarnings.map((warning) => (
              <div
                key={warning.label}
                className="border border-border p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", fontWeight: 500 }} className="text-foreground">
                    {warning.label}
                  </h3>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A857E" }}>
                    {warning.severity}
                  </span>
                </div>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem", color: "#8A857E", lineHeight: 1.6 }} className="mt-1">
                  {warning.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasEpistemic && timelineWarnings.length === 0 && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E", lineHeight: 1.7 }} className="mt-3">
          The epistemic layer will map who knows what when once the outline
          includes clear information-transfer events.
        </p>
      )}
    </div>
  );
}

function statusCopy(status: string) {
  switch (status) {
    case "reading-outline":
      return "Reading outline";
    case "searching-knowledge-graph":
      return "Searching knowledge graph";
    case "comparing-masterworks":
      return "Comparing structural DNA";
    case "checking-knowledge-flow":
      return "Checking knowledge flow";
    case "":
      return "Waiting for structure";
    default:
      return status;
  }
}
