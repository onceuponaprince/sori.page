"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { CharacterEditor } from "@/components/playground/CharacterEditor";
import { CharacterFolder } from "@/components/playground/CharacterFolder";
import { PublishBar } from "@/components/playground/PublishBar";
import { PlaygroundOnboarding } from "@/components/onboarding/PlaygroundOnboarding";
import { usePlaygroundCharacters } from "@/lib/use-playground-characters";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function StoryCharactersPage({ params }: PageProps) {
  const { id: storyUid } = use(params);
  const {
    characters,
    publishedCharacters,
    loading,
    error: loadError,
    createCharacter,
    fetchCharacter,
    deleteCharacter,
    saveDraft,
    publishCharacter,
    submitComponent,
  } = usePlaygroundCharacters(storyUid);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [staleRevision, setStaleRevision] = useState(false);
  const [tagFilter, setTagFilter] = useState("");

  const selected = useMemo(
    () => characters.find((c) => c.id === selectedId) ?? null,
    [characters, selectedId],
  );

  useEffect(() => {
    if (!selectedId && characters.length > 0) {
      setSelectedId(characters[0].id);
    }
  }, [characters, selectedId]);

  useEffect(() => {
    if (selected) {
      setEditorValue(selected.draftSource || "");
      setDirty(false);
      setActionError(null);
      setStaleRevision(false);
    }
  }, [selected?.id, selected?.draftRevision, selected?.draftSource]);

  const handleCreate = useCallback(
    async (name: string) => {
      const created = await createCharacter(name.trim());
      setSelectedId(created.id);
    },
    [createCharacter],
  );

  const reloadSelectedCharacter = useCallback(
    async (clearStale = true) => {
      if (!selected) return;
      setActionError(null);
      try {
        const fresh = await fetchCharacter(selected.id);
        setEditorValue(fresh.draftSource || "");
        setDirty(false);
        if (clearStale) {
          setStaleRevision(false);
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Reload failed");
      }
    },
    [selected, fetchCharacter],
  );

  const handleSave = useCallback(async () => {
    if (!selected || staleRevision) return;
    setSaving(true);
    setActionError(null);
    try {
      await saveDraft(selected.id, editorValue, selected.draftRevision);
      setDirty(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [selected, editorValue, saveDraft, staleRevision]);

  const handlePublish = useCallback(async () => {
    if (!selected || staleRevision) return;
    setPublishing(true);
    setActionError(null);
    try {
      let revision = selected.draftRevision;
      if (dirty) {
        const updated = await saveDraft(selected.id, editorValue, selected.draftRevision);
        revision = updated.draftRevision;
        setDirty(false);
      }
      await publishCharacter(selected.id, revision);
      setStaleRevision(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publish failed";
      if (message === "STALE_REVISION") {
        setStaleRevision(true);
        setActionError(null);
        await reloadSelectedCharacter(false);
      } else {
        setActionError(message);
      }
    } finally {
      setPublishing(false);
    }
  }, [
    selected,
    dirty,
    editorValue,
    saveDraft,
    publishCharacter,
    staleRevision,
    reloadSelectedCharacter,
  ]);

  const handleDiscard = useCallback(async () => {
    if (!selected) return;
    setActionError(null);
    try {
      const fresh = await fetchCharacter(selected.id);
      const revert =
        fresh.isPublished && fresh.publishedSource
          ? fresh.publishedSource
          : fresh.draftSource || "";
      setEditorValue(revert);
      setDirty(false);
      setStaleRevision(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Discard failed");
    }
  }, [selected, fetchCharacter]);

  const handleDelete = useCallback(async () => {
    if (!selected || selected.isPublished || deleting) return;

    const confirmed = window.confirm(
      `Delete "${selected.name}"? This unpublished draft will be removed permanently.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setActionError(null);
    try {
      const deletedId = selected.id;
      await deleteCharacter(deletedId);
      setSelectedId((current) => (current === deletedId ? null : current));
      setEditorValue("");
      setDirty(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }, [selected, deleting, deleteCharacter]);

  if (loading) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Loading characters…</div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      {loadError && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
          {loadError}
        </div>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[260px_1fr]">
        <CharacterFolder
          characters={characters}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={handleCreate}
          onSubmitComponent={submitComponent}
          tagFilter={tagFilter}
          onTagFilterChange={setTagFilter}
        />
        <div className="flex min-h-0 flex-col overflow-y-auto">
          {publishedCharacters.length === 0 && (
            <PlaygroundOnboarding
              storyUid={storyUid}
              hasCharacters={characters.length > 0}
              hasPublished={publishedCharacters.length > 0}
            />
          )}
          {selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2 text-sm text-muted-foreground">
                <div>
                  Editing <strong className="text-foreground">{selected.virtualPath}</strong>
                  {selected.sourceType === "react" && selected.reviewStatus === "pending" && (
                    <span className="ml-2 text-xs text-amber-600">
                      — contributor review pending; editing locked
                    </span>
                  )}
                </div>
                {!selected.isPublished && (
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    className="border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Delete draft"}
                  </button>
                )}
              </div>
              <div className="min-h-0 flex-1 p-4">
                <CharacterEditor
                  value={editorValue}
                  disabled={
                    selected.sourceType === "react" && selected.reviewStatus === "pending"
                  }
                  onChange={(v) => {
                    setEditorValue(v);
                    setDirty(true);
                    setStaleRevision(false);
                  }}
                />
              </div>
              {selected.sourceType === "react" && selected.reviewStatus === "pending" ? (
                <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
                  This React component is awaiting contributor review and cannot be published yet.
                </div>
              ) : (
                <PublishBar
                  dirty={dirty}
                  isPublished={selected.isPublished}
                  saving={saving}
                  publishing={publishing}
                  error={actionError}
                  staleRevision={staleRevision}
                  onSave={handleSave}
                  onPublish={handlePublish}
                  onDiscard={() => void handleDiscard()}
                  onReload={() => void reloadSelectedCharacter(true)}
                />
              )}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
              Select a character or create a new one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
