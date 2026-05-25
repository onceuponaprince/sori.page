"use client";

import { useMemo, useState } from "react";
import type { PlaygroundCharacter } from "@/types/character";
import { extractCharacterBio } from "@/lib/character-md";
import { ComponentSubmitForm } from "@/components/playground/ComponentSubmitForm";

type FolderTab = "characters" | "components";
export type CharacterSortMode = "recent" | "published" | "name";

interface CharacterFolderProps {
  characters: PlaygroundCharacter[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void | Promise<void>;
  onSubmitComponent?: (source: string, filename?: string) => Promise<unknown>;
  tagFilter: string;
  onTagFilterChange: (tag: string) => void;
}

function ReviewStatusBadge({ character }: { character: PlaygroundCharacter }) {
  if (character.sourceType !== "react") {
    return null;
  }

  if (character.reviewStatus === "pending") {
    return (
      <span className="mt-1 inline-block text-[10px] uppercase tracking-wide text-amber-600">
        Review pending
      </span>
    );
  }

  if (character.reviewStatus === "rejected") {
    return (
      <span className="mt-1 inline-block text-[10px] uppercase tracking-wide text-red-600">
        Review rejected
      </span>
    );
  }

  if (character.reviewStatus === "approved" && !character.isPublished) {
    return (
      <span className="mt-1 inline-block text-[10px] uppercase tracking-wide text-sky-600">
        Approved — publish to use
      </span>
    );
  }

  return null;
}

function PublishBadge({ character }: { character: PlaygroundCharacter }) {
  if (character.sourceType === "react" && character.reviewStatus === "pending") {
    return null;
  }

  if (!character.isPublished) {
    return (
      <span className="mt-1 inline-block text-[10px] uppercase tracking-wide text-amber-600">
        Unpublished draft
      </span>
    );
  }

  return (
    <span className="mt-1 inline-block text-[10px] uppercase tracking-wide text-emerald-600">
      Published
    </span>
  );
}

function matchesSearch(character: PlaygroundCharacter, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const needle = trimmed.toLowerCase();
  const bio = extractCharacterBio(character.draftSource || "");
  const haystacks = [character.name, bio, character.draftSource || ""];

  return haystacks.some((value) => value.toLowerCase().includes(needle));
}

function sortCharacters(
  list: PlaygroundCharacter[],
  mode: CharacterSortMode,
): PlaygroundCharacter[] {
  const sorted = [...list];

  switch (mode) {
    case "recent":
      sorted.sort((a, b) => {
        const aKey = a.updatedAt
          ? new Date(a.updatedAt).getTime()
          : a.draftRevision;
        const bKey = b.updatedAt
          ? new Date(b.updatedAt).getTime()
          : b.draftRevision;
        return bKey - aKey;
      });
      break;
    case "published":
      sorted.sort((a, b) => {
        if (a.isPublished !== b.isPublished) {
          return a.isPublished ? -1 : 1;
        }
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
      break;
    case "name":
      sorted.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
      break;
  }

  return sorted;
}

function filterAndSort(
  list: PlaygroundCharacter[],
  searchQuery: string,
  tagFilter: string,
  sortMode: CharacterSortMode,
): PlaygroundCharacter[] {
  let filtered = list.filter((c) => matchesSearch(c, searchQuery));
  if (tagFilter) {
    filtered = filtered.filter((c) => c.tags?.includes(tagFilter));
  }
  return sortCharacters(filtered, sortMode);
}

export function CharacterFolder({
  characters,
  selectedId,
  onSelect,
  onCreate,
  onSubmitComponent,
  tagFilter,
  onTagFilterChange,
}: CharacterFolderProps) {
  const [activeTab, setActiveTab] = useState<FolderTab>("characters");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<CharacterSortMode>("recent");

  const mdCharacters = characters.filter((c) => c.sourceType !== "react");
  const reactCharacters = characters.filter((c) => c.sourceType === "react");

  const allTags = Array.from(
    new Set(characters.flatMap((c) => c.tags || [])),
  ).sort();

  const filteredMd = useMemo(
    () => filterAndSort(mdCharacters, searchQuery, tagFilter, sortMode),
    [mdCharacters, searchQuery, tagFilter, sortMode],
  );

  const filteredReact = useMemo(
    () => filterAndSort(reactCharacters, searchQuery, tagFilter, sortMode),
    [reactCharacters, searchQuery, tagFilter, sortMode],
  );

  async function handleSubmitCreate(event: React.FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name || creating) return;

    setCreating(true);
    setCreateError(null);
    try {
      await onCreate(name);
      setNewName("");
      setShowCreateForm(false);
      setActiveTab("characters");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  const searchControls = (
    <div className="space-y-2 border-b border-border p-3">
      <label className="block text-xs text-muted-foreground" htmlFor="character-search">
        Search
      </label>
      <input
        id="character-search"
        type="search"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Name, bio, or draft text…"
        className="w-full border border-border bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
      />
      <label className="block text-xs text-muted-foreground" htmlFor="character-sort">
        Sort
      </label>
      <select
        id="character-sort"
        value={sortMode}
        onChange={(event) => setSortMode(event.target.value as CharacterSortMode)}
        className="w-full border border-border bg-transparent px-2 py-1 text-sm"
      >
        <option value="recent">Recently edited</option>
        <option value="published">Published first</option>
        <option value="name">Name A–Z</option>
      </select>
      {allTags.length > 0 && (
        <>
          <label className="block text-xs text-muted-foreground" htmlFor="character-tag-filter">
            Filter by tag
          </label>
          <select
            id="character-tag-filter"
            value={tagFilter}
            onChange={(e) => onTagFilterChange(e.target.value)}
            className="w-full border border-border bg-transparent px-2 py-1 text-sm"
          >
            <option value="">All tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );

  return (
    <aside className="flex h-full flex-col border border-border bg-card">
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("characters")}
          className={`flex-1 px-3 py-2 text-xs uppercase tracking-wide ${
            activeTab === "characters"
              ? "border-b-2 border-accent text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          characters/
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("components")}
          className={`flex-1 px-3 py-2 text-xs uppercase tracking-wide ${
            activeTab === "components"
              ? "border-b-2 border-accent text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          _components/
        </button>
      </div>

      {activeTab === "characters" ? (
        <>
          <div className="border-b border-border p-3">
            {showCreateForm ? (
              <form onSubmit={handleSubmitCreate} className="space-y-2">
                <label className="block text-xs text-muted-foreground" htmlFor="new-character-name">
                  Character name
                </label>
                <input
                  id="new-character-name"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Maya Chen"
                  autoFocus
                  className="w-full border border-border bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                />
                {createError && (
                  <p className="text-xs text-red-600" role="alert">
                    {createError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={!newName.trim() || creating}
                    className="flex-1 border border-accent px-2 py-1.5 text-xs text-accent hover:bg-accent hover:text-white disabled:opacity-50"
                  >
                    {creating ? "Creating…" : "Create"}
                  </button>
                  <button
                    type="button"
                    disabled={creating}
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewName("");
                      setCreateError(null);
                    }}
                    className="border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="w-full border border-accent px-3 py-2 text-sm text-accent hover:bg-accent hover:text-white"
              >
                + New character
              </button>
            )}
          </div>
          {searchControls}
          <ul className="flex-1 overflow-y-auto p-2">
            {filteredMd.length === 0 && (
              <li className="px-2 py-4 text-sm text-muted-foreground">
                {mdCharacters.length === 0
                  ? "No MD characters yet. Create one to get started."
                  : "No characters match your search or filters."}
              </li>
            )}
            {filteredMd.map((char) => (
              <li key={char.id}>
                <button
                  type="button"
                  onClick={() => onSelect(char.id)}
                  className={`mb-1 w-full border px-3 py-2 text-left text-sm transition-colors ${
                    selectedId === char.id
                      ? "border-foreground bg-foreground/5"
                      : "border-transparent hover:border-border"
                  }`}
                >
                  <div className="font-medium">{char.name}</div>
                  <div className="text-xs text-muted-foreground">{char.virtualPath}</div>
                  <PublishBadge character={char} />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          {onSubmitComponent && <ComponentSubmitForm onSubmit={onSubmitComponent} />}
          {searchControls}
          <ul className="flex-1 overflow-y-auto p-2">
            {filteredReact.length === 0 && (
              <li className="px-2 py-4 text-sm text-muted-foreground">
                {reactCharacters.length === 0
                  ? "No React components yet. Submit one above for contributor review."
                  : "No components match your search or filters."}
              </li>
            )}
            {filteredReact.map((char) => (
              <li key={char.id}>
                <button
                  type="button"
                  onClick={() => onSelect(char.id)}
                  className={`mb-1 w-full border px-3 py-2 text-left text-sm transition-colors ${
                    selectedId === char.id
                      ? "border-foreground bg-foreground/5"
                      : "border-transparent hover:border-border"
                  }`}
                >
                  <div className="font-medium">{char.name}</div>
                  <div className="text-xs text-muted-foreground">{char.virtualPath}</div>
                  <ReviewStatusBadge character={char} />
                  <PublishBadge character={char} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
