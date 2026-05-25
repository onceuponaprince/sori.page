"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CharacterPicker } from "@/components/playground/CharacterPicker";
import type { PlaygroundCharacter } from "@/types/character";
import { useCharacterChat } from "@/lib/use-character-chat";

interface TalkPanelProps {
  storyUid: string;
  publishedCharacters: PlaygroundCharacter[];
}

export function TalkPanel({ storyUid, publishedCharacters }: TalkPanelProps) {
  const searchParams = useSearchParams();
  const urlThreadId = searchParams.get("thread_id");
  const [selectedId, setSelectedId] = useState<string | null>(
    publishedCharacters[0]?.id ?? null,
  );
  const [input, setInput] = useState("");
  const { messages, loading, hydrating, error, creditBlocked, sendMessage } =
    useCharacterChat(storyUid, {
      characterId: selectedId,
      initialThreadId: urlThreadId,
    });

  const selected = publishedCharacters.find((c) => c.id === selectedId);
  const busy = loading || hydrating;

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="border-b border-border px-4 py-4 md:px-6">
        <p className="sori-kicker">solo chat</p>
        <h1
          style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem" }}
          className="mt-1 font-medium"
        >
          Talk
        </h1>
        <div className="mt-3">
          <CharacterPicker
            characters={publishedCharacters}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        {selected && (
          <p className="mt-2 text-xs text-muted-foreground">
            In conversation with {selected.name}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {hydrating && (
          <p className="text-sm text-muted-foreground">Loading conversation…</p>
        )}
        {!hydrating && messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Say something to {selected?.name ?? "your character"}.
          </p>
        )}
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div
              key={`${msg.role}-${i}`}
              className={`max-w-xl rounded border px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "ml-auto border-border bg-card"
                  : "border-accent/30 bg-accent/5"
              }`}
            >
              <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {msg.role === "user" ? "You" : selected?.name ?? "Character"}
              </p>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))}
        </div>
      </div>

      <form
        className="border-t border-border px-4 py-4 md:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!selectedId || !input.trim() || busy) return;
          void sendMessage(selectedId, input.trim());
          setInput("");
        }}
      >
        {error && (
          <div className="mb-2" role="alert">
            <p className="text-sm text-red-600">{error}</p>
            {creditBlocked && (
              <Link
                href="/account"
                className="mt-1 inline-block text-sm text-foreground underline-offset-2 hover:underline"
              >
                Upgrade on Account →
              </Link>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!selectedId || busy}
            placeholder={selected ? `Message ${selected.name}…` : "Select a character"}
            className="flex-1 border border-border bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!selectedId || !input.trim() || busy}
            className="border border-accent bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {loading ? "…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
