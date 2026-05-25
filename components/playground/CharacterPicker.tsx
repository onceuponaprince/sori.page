"use client";

import type { PlaygroundCharacter } from "@/types/character";

interface CharacterPickerProps {
  characters: PlaygroundCharacter[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CharacterPicker({
  characters,
  selectedId,
  onSelect,
}: CharacterPickerProps) {
  if (characters.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No published characters. Publish one in the Characters tab first.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {characters.map((char) => (
        <button
          key={char.id}
          type="button"
          onClick={() => onSelect(char.id)}
          className={`border px-3 py-1.5 text-sm transition-colors ${
            selectedId === char.id
              ? "border-foreground bg-foreground text-background"
              : "border-border hover:border-accent"
          }`}
        >
          {char.name}
        </button>
      ))}
    </div>
  );
}
