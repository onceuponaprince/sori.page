"use client";

/**
 * Thin wrapper around usePlaygroundCharacters for consumers that only need
 * canonical CharacterNode UIDs (Multiverse Lab dropdowns, etc.).
 *
 * @see usePlaygroundCharacters — full roster + draft/publish CRUD
 */

import { useMemo } from "react";
import { usePlaygroundCharacters } from "@/lib/use-playground-characters";
import type { PlaygroundCharacter } from "@/types/character";

export type StoryCharacter = Pick<
  PlaygroundCharacter,
  "id" | "name" | "roleHint" | "aliases"
>;

export function useStoryCharacters(storyUid: string) {
  const { characters, loading, error, refresh } = usePlaygroundCharacters(storyUid);

  const slimCharacters = useMemo(
    () =>
      characters.map((c) => ({
        id: c.id,
        name: c.name,
        roleHint: c.roleHint,
        aliases: c.aliases,
      })),
    [characters],
  );

  return {
    characters: slimCharacters,
    loading,
    error,
    refresh,
  };
}
