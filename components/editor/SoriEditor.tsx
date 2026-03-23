"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { JSONContent } from "@tiptap/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStream } from "@/lib/use-stream";
import { createBrowserClient } from "@/lib/supabase";
import type { AnalyzerResult, EpistemicState } from "@/lib/analyzer-types";

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
      title: "Untitled Treehouse Draft",
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
      title: "Untitled Treehouse Draft",
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
      title: parsed.title || "Untitled Treehouse Draft",
      outlineText: parsed.outlineText || "",
      editorJson: parsed.editorJson || createEmptyDocument(parsed.outlineText || ""),
      analysis: parsed.analysis ?? null,
    };
  } catch {
    return {
      storyUid: crypto.randomUUID(),
      sceneUid: crypto.randomUUID(),
      title: "Untitled Treehouse Draft",
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
    // Local storage is the fast, always-available recovery layer. The draft API
    // below is the cross-session/server layer. Keeping both makes handoff safer.
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
      // Save is intentionally debounced separately from analysis so a failed
      // analyzer call never blocks persistence of the writer's work.
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

        setSavedLabel("Saved to treehouse");
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
      // Avoid re-analyzing the exact same text snapshot while a previous request
      // is still in flight. This keeps the sidebar responsive without thrashing.
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
  }, [generate, loading, plainText, title]);

  if (!mounted) {
    return (
      <div className="grid gap-5 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr),360px]">
        <section className="sori-paper rounded-[1.75rem] p-6">
          <div className="h-[72dvh] rounded-[1.5rem] border border-border/60 bg-background/35" />
        </section>
        <aside className="space-y-4">
          <div className="sori-paper rounded-[1.75rem] p-6">
            <p className="text-sm text-[var(--sori-text-secondary)]">
              Opening the treehouse...
            </p>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="grid gap-5 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr),360px]">
      <section className="sori-paper rounded-[1.75rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 border-b border-border/65 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <p className="sori-kicker text-xs">writer&apos;s treehouse</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="max-w-xl text-lg"
                placeholder="Name your draft"
              />
              <div className="flex flex-wrap gap-2">
                <span className="sori-chip rounded-full px-3 py-1">
                  story_uid {storyUid.slice(0, 8)}
                </span>
                <span className="sori-chip rounded-full px-3 py-1">{savedLabel}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() =>
                generate({
                  title,
                  outline: plainText,
                  story_uid: storyUid,
                })
              }
              disabled={plainText.trim().length < 40 || loading}
            >
              {loading ? "Reading structure..." : "Run analyzer"}
            </Button>
          </div>
        </div>

        <div className="mt-5">
          <div className="sori-editor-surface rounded-[1.5rem] p-5 sm:p-7">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="m-0 text-sm text-[var(--sori-text-secondary)]">
                Draft freely. The sidebar will update when the story reveals a
                structural pattern.
              </p>
              <span className="text-xs uppercase tracking-[0.16em] text-[var(--sori-text-muted)]">
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
      <div className="sori-paper rounded-[1.75rem] p-5">
        <p className="sori-kicker text-xs">live sidebar</p>
        <h2 className="mt-3 text-3xl">Structural pulse</h2>
        <p className="mt-3 text-sm text-[var(--sori-text-secondary)]">
          This pane stays focused on story logic, comparison, and knowledge flow.
          It never writes the scene for you.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="sori-chip rounded-full px-3 py-1">
            {loading ? readableStatus : analysis?.confidenceLabel || "Waiting for structure"}
          </span>
          {metadataCurrentArc && (
            <span className="sori-chip rounded-full px-3 py-1">
              {metadataCurrentArc}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-[1.4rem] border border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {analysis ? (
        <>
          {/* Keep the sidebar flat and inspectable during handoff: each block
              mirrors a top-level field returned by the analyzer contract. */}
          <SidebarCard title="Summary" body={analysis.summary} />
          <SidebarCard title="Current Arc" body={analysis.currentArc} />

          <div className="sori-panel rounded-[1.4rem] p-4">
            <p className="sori-kicker text-xs">Pattern matches</p>
            <div className="mt-3 space-y-3">
              {analysis.patternMatches.map((match) => (
                <div key={match.id} className="rounded-[1rem] border border-border/65 bg-background/45 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg">{match.label}</h3>
                    <span className="text-xs text-[var(--sori-text-muted)]">
                      {Math.round(match.confidence * 100)}%
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--sori-text-secondary)]">
                    {match.whyItFits}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="sori-panel rounded-[1.4rem] p-4">
            <p className="sori-kicker text-xs">Stories like yours</p>
            <div className="mt-3 space-y-3">
              {analysis.crossGenreComparisons.map((story) => (
                <div key={story.title} className="rounded-[1rem] border border-border/65 bg-background/45 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg">{story.title}</h3>
                    <span className="text-xs uppercase tracking-[0.14em] text-[var(--sori-text-muted)]">
                      {story.medium}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--sori-text-secondary)]">
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

          <div className="sori-panel rounded-[1.4rem] p-4">
            <p className="sori-kicker text-xs">Gentle questions</p>
            <div className="mt-3 space-y-3">
              {analysis.gentleQuestions.map((question) => (
                <div key={question.id} className="rounded-[1rem] border border-border/65 bg-background/45 p-3 text-sm text-[var(--sori-text-secondary)]">
                  {question.prompt}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="sori-panel rounded-[1.4rem] p-5">
          <p className="sori-kicker text-xs">first pass</p>
          <p className="mt-3 text-sm text-[var(--sori-text-secondary)]">
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
    <div className="sori-panel rounded-[1.4rem] p-4">
      <p className="sori-kicker text-xs">{title}</p>
      <p className="mt-3 text-sm text-[var(--sori-text-secondary)]">{body}</p>
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
    <div className="sori-panel rounded-[1.4rem] p-4">
      <p className="sori-kicker text-xs">Knowledge flow</p>

      {hasEpistemic && (
        <>
          {epistemicState.characters.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-[var(--sori-text-muted)]">
                Characters
              </p>
              <div className="flex flex-wrap gap-1.5">
                {epistemicState.characters.map((char) => (
                  <span
                    key={char.name}
                    className="sori-chip rounded-full px-2.5 py-0.5 text-xs"
                  >
                    {char.name}
                    {char.roleHint && (
                      <span className="ml-1 text-[var(--sori-text-muted)]">
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
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-[var(--sori-text-muted)]">
                Story facts
              </p>
              <div className="space-y-2">
                {epistemicState.facts.map((fact, idx) => (
                  <div
                    key={`${fact.description.slice(0, 20)}-${idx}`}
                    className="rounded-[0.85rem] border border-border/55 bg-background/35 p-2.5 text-xs"
                  >
                    <p className="text-[var(--sori-text-secondary)]">
                      {fact.description}
                    </p>
                    <p className="mt-1 text-[var(--sori-text-muted)]">
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
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-destructive/80">
                Unearned knowledge
              </p>
              <div className="space-y-2">
                {epistemicState.violations.map((v, idx) => (
                  <div
                    key={`${v.character}-${v.actsAtBeat}-${idx}`}
                    className="rounded-[0.85rem] border border-destructive/30 bg-destructive/5 p-2.5 text-xs"
                  >
                    <p className="font-medium text-destructive">
                      {v.character} acts on unearned knowledge at beat{" "}
                      {v.actsAtBeat}
                    </p>
                    <p className="mt-1 text-[var(--sori-text-secondary)]">
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
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-[var(--sori-text-muted)]">
              Additional checks
            </p>
          )}
          <div className="space-y-2">
            {timelineWarnings.map((warning) => (
              <div
                key={warning.label}
                className="rounded-[0.85rem] border border-border/55 bg-background/35 p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm">{warning.label}</h3>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--sori-text-muted)]">
                    {warning.severity}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--sori-text-secondary)]">
                  {warning.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasEpistemic && timelineWarnings.length === 0 && (
        <p className="mt-3 text-sm text-[var(--sori-text-secondary)]">
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
