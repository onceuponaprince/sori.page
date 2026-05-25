"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { JSONContent } from "@tiptap/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStream } from "@/lib/use-stream";
import { createBrowserClient } from "@/lib/supabase/client";
import { useStoryCharacters } from "@/lib/use-story-characters";
import type { AnalyzerResult, EpistemicState } from "@/lib/analyzer-types";
import { MultiverseSidebar } from "@/components/multiverse/MultiverseSidebar";
import { FormatToolbar } from "@/components/playground/FormatToolbar";
import { UseAsSceneGoalButton } from "@/components/playground/UseAsSceneGoalButton";
import { playgroundEditorExtensions } from "@/lib/tiptap/script-nodes";
import type { FormatPreset } from "@/lib/format-presets";
import { useStoryBeatOptional } from "@/lib/story-beat-context";

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

function extractPlainText(doc: JSONContent): string {
  const parts: string[] = [];

  function walk(node: JSONContent) {
    if (node.type === "text" && node.text) {
      parts.push(node.text);
      return;
    }
    (node.content || []).forEach(walk);
    if (node.type === "paragraph" || node.type === "heading") {
      parts.push("\n");
    }
  }

  walk(doc);
  return parts.join("").trim();
}

async function buildStoryAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createBrowserClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const accessToken = session?.access_token;
  const tenantId =
    (session?.user?.user_metadata?.tenant_id as string | undefined) ||
    (session?.user?.app_metadata?.tenant_id as string | undefined);

  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (tenantId) headers["X-Tenant-Id"] = tenantId;

  return headers;
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

interface SoriEditorProps {
  /**
   * Overrides the localStorage-derived storyUid. Used by /story/[id]
   * route to pin the editor to a specific story. When absent, the
   * legacy /write entry point keeps its own localStorage draft.
   */
  storyUid?: string;
}

export function SoriEditor({ storyUid: storyUidOverride }: SoriEditorProps = {}) {
  const initialDraft = useMemo(loadStoredDraft, []);
  const isStoryScoped = Boolean(storyUidOverride);
  const [mounted, setMounted] = useState(false);
  const [storyUid] = useState(storyUidOverride ?? initialDraft.storyUid);
  const [sceneUid] = useState(initialDraft.sceneUid);
  const [title, setTitle] = useState(initialDraft.title);
  const [plainText, setPlainText] = useState(initialDraft.outlineText);
  const [editorJson, setEditorJson] = useState<JSONContent>(initialDraft.editorJson);
  const [editorPreset, setEditorPreset] = useState<FormatPreset>("novel");
  const [storyDocumentLoaded, setStoryDocumentLoaded] = useState(!isStoryScoped);
  const [savedLabel, setSavedLabel] = useState(
    isStoryScoped ? "Loading story…" : "Saved locally",
  );
  const [userId, setUserId] = useState<string | null>(null);
  const lastAnalyzedRef = useRef("");

  const [multiverseOpen, setMultiverseOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");

  const { characters: storyCharacters } = useStoryCharacters(storyUid);
  const storyBeat = useStoryBeatOptional();

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
      ...playgroundEditorExtensions,
    ],
    content: editorJson,
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
  }, [storyDocumentLoaded]);

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
    if (!isStoryScoped || !storyUidOverride) {
      return;
    }

    let cancelled = false;

    async function loadStoryDocument() {
      setSavedLabel("Loading story…");
      try {
        const response = await fetch(`/api/story/${storyUidOverride}/document`, {
          headers: await buildStoryAuthHeaders(),
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Story document load failed");
        }

        const payload = (await response.json()) as {
          title?: string;
          editorDocument?: JSONContent | null;
          editorPreset?: FormatPreset;
        };

        if (cancelled) return;

        if (payload.title) {
          setTitle(payload.title);
        }
        if (payload.editorPreset === "novel" || payload.editorPreset === "script") {
          setEditorPreset(payload.editorPreset);
        }
        if (payload.editorDocument) {
          setEditorJson(payload.editorDocument);
          setPlainText(extractPlainText(payload.editorDocument));
        }

        setStoryDocumentLoaded(true);
        setSavedLabel("Saved");
      } catch {
        if (!cancelled) {
          setStoryDocumentLoaded(true);
          setSavedLabel("Saved locally");
        }
      }
    }

    loadStoryDocument();

    return () => {
      cancelled = true;
    };
  }, [isStoryScoped, storyUidOverride]);

  useEffect(() => {
    if (!isStoryScoped || !storyDocumentLoaded) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      setSavedLabel("Saving...");
      try {
        const response = await fetch(`/api/story/${storyUid}/document`, {
          method: "PUT",
          headers: await buildStoryAuthHeaders(),
          body: JSON.stringify({
            editor_document: editorJson,
            editor_preset: editorPreset,
          }),
        });

        if (!response.ok) {
          throw new Error("Story document save failed");
        }

        setSavedLabel("Saved");
      } catch {
        setSavedLabel("Save failed");
      }
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [editorJson, editorPreset, isStoryScoped, storyDocumentLoaded, storyUid]);

  useEffect(() => {
    if (isStoryScoped) {
      return;
    }

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
  }, [analysis, editorJson, initialDraft.analysis, isStoryScoped, plainText, sceneUid, storyUid, title]);

  useEffect(() => {
    if (isStoryScoped) {
      return;
    }

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
  }, [analysis, editorJson, isStoryScoped, plainText, sceneUid, storyUid, title, userId]);

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

  const handleBeatCreated = useCallback((beatId: string, summary: string, pattern: string) => {
    if (!editor) return;

    editor.commands.insertContent([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            marks: [{ type: "bold" }],
            text: `[Beat: ${pattern}] `,
          },
          { type: "text", text: summary },
        ],
      },
      { type: "paragraph" },
    ]);

    setSavedLabel(`Beat ${beatId.slice(0, 8)} inserted`);
  }, [editor]);

  useEffect(() => {
    if (!isStoryScoped || !storyBeat) return;
    storyBeat.registerBeatHandler(handleBeatCreated);
    return () => storyBeat.unregisterBeatHandler();
  }, [isStoryScoped, storyBeat, handleBeatCreated]);

  useEffect(() => {
    if (!editor || !isStoryScoped) return;

    function updateSelection() {
      const { from, to, empty } = editor!.state.selection;
      if (empty || from === to) {
        setSelectedText("");
        return;
      }
      setSelectedText(editor!.state.doc.textBetween(from, to, " ").trim());
    }

    updateSelection();
    editor.on("selectionUpdate", updateSelection);
    return () => {
      editor.off("selectionUpdate", updateSelection);
    };
  }, [editor, isStoryScoped]);

  useEffect(() => {
    if (!isStoryScoped || !storyUidOverride || !editor) return;

    async function reloadDocumentFromBeatInsert(event: Event) {
      const detail = (event as CustomEvent<{ storyUid?: string }>).detail;
      if (detail?.storyUid && detail.storyUid !== storyUidOverride) return;
      if (!editor) return;

      try {
        const response = await fetch(`/api/story/${storyUidOverride}/document`, {
          headers: await buildStoryAuthHeaders(),
          cache: "no-store",
        });
        if (!response.ok) return;

        const payload = (await response.json()) as {
          editorDocument?: JSONContent | null;
        };
        if (payload.editorDocument) {
          editor.commands.setContent(payload.editorDocument);
          setEditorJson(payload.editorDocument);
          setPlainText(extractPlainText(payload.editorDocument));
          setSavedLabel("Beat inserted from Scene");
        }
      } catch {
        // Ignore reload failures; autosave will reconcile on next edit.
      }
    }

    window.addEventListener("story-beat-inserted", reloadDocumentFromBeatInsert);
    return () => {
      window.removeEventListener("story-beat-inserted", reloadDocumentFromBeatInsert);
    };
  }, [isStoryScoped, storyUidOverride, editor]);
  if (!mounted || (isStoryScoped && !storyDocumentLoaded)) {
    return (
      <div className="space-y-4">
        {!isStoryScoped && (
          <SaveToStoryBanner />
        )}
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
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!isStoryScoped && (
        <SaveToStoryBanner />
      )}
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
              {isStoryScoped && (
                <>
                  <FormatToolbar
                    editor={editor}
                    preset={editorPreset}
                    onPresetChange={setEditorPreset}
                    onFormatted={(doc) => {
                      setEditorJson(doc);
                      setPlainText(editor?.getText() ?? "");
                    }}
                  />
                  <UseAsSceneGoalButton
                    editor={editor}
                    storyUid={storyUid}
                    selectedText={selectedText}
                  />
                </>
              )}
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
            {!isStoryScoped && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMultiverseOpen(!multiverseOpen)}
                className={multiverseOpen ? "border-accent text-accent" : ""}
              >
                {multiverseOpen ? "Close Lab" : "Test"}
              </Button>
            )}
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

      {!isStoryScoped && multiverseOpen && (
        <MultiverseSidebar
          storyUid={storyUid}
          isOpen={multiverseOpen}
          onClose={() => setMultiverseOpen(false)}
          onBeatCreated={handleBeatCreated}
          availableCharacterIds={
            // Prefer canonical CharacterNode UIDs from the graph so the
            // backend can find them during simulate_scene. Fall back to
            // the analyzer's detected names ONLY when the graph has not
            // yet persisted any character rows for this story; that
            // path will still raise CHARACTER_NOT_FOUND on simulate, but
            // the UI degrades gracefully.
            storyCharacters.length > 0
              ? storyCharacters.map((c) => ({ id: c.id, name: c.name }))
              : analysis?.epistemicState?.characters.map((c) => ({
                  id: c.name.toLowerCase().replace(/\s+/g, "-"),
                  name: c.name,
                })) || []
          }
        />
      )}
      </div>
    </div>
  );
}

function SaveToStoryBanner() {
  return (
    <div className="mx-4 mt-4 border border-accent/30 bg-accent/5 px-4 py-3 md:mx-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground">
          Characters, Talk, and Scene need a saved story. Promote this draft to unlock the playground.
        </p>
        <Link
          href="/story/new"
          className="shrink-0 border border-accent px-3 py-1.5 text-sm text-accent transition-colors hover:bg-accent hover:text-white"
        >
          Save to story
        </Link>
      </div>
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
