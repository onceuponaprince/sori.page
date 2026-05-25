"use client";

/**
 * useStoryCharacters() — fetch the list of CharacterNode rows that
 * belong to a story, scoped to the current tenant.
 *
 * The Multiverse Sidebar needs real CharacterNode UIDs (not slugified
 * display names) to start a simulation. The legacy SoriEditor path
 * derived IDs by lower-casing the analyzer's detected character names,
 * which the Django backend then rejected as CHARACTER_NOT_FOUND.
 *
 * This hook returns the canonical list. Consumers should:
 *   1. Render the returned list if non-empty.
 *   2. Fall back to a "graph has no characters yet" message otherwise.
 *
 * The endpoint is GET /api/agent/characters/<storyUid> (proxied to
 * the tenant engine via /app/api/agent/characters/[storyUid]/route.ts).
 */

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export interface StoryCharacter {
  /** CharacterNode.uid in Neo4j */
  id: string;
  name: string;
  roleHint: string | null;
  aliases: string[];
}

interface UseStoryCharactersReturn {
  characters: StoryCharacter[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createBrowserClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;

  const headers: Record<string, string> = {};
  const accessToken = session?.access_token;
  const tenantId =
    (session?.user?.user_metadata?.tenant_id as string | undefined) ||
    (session?.user?.app_metadata?.tenant_id as string | undefined);

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (tenantId) {
    headers["X-Tenant-Id"] = tenantId;
  }

  return headers;
}

export function useStoryCharacters(storyUid: string): UseStoryCharactersReturn {
  const [characters, setCharacters] = useState<StoryCharacter[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(storyUid));
  const [error, setError] = useState<string | null>(null);

  const fetchCharacters = useCallback(async (): Promise<void> => {
    if (!storyUid) {
      setCharacters([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/agent/characters/${storyUid}`, {
        headers: await buildAuthHeaders(),
        cache: "no-store",
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          payload?.error || `Character fetch failed: ${res.status}`,
        );
      }

      const data = (await res.json()) as { characters: StoryCharacter[] };
      setCharacters(Array.isArray(data.characters) ? data.characters : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load characters");
      setCharacters([]);
    } finally {
      setLoading(false);
    }
  }, [storyUid]);

  useEffect(() => {
    void fetchCharacters();
  }, [fetchCharacters]);

  return {
    characters,
    loading,
    error,
    refresh: fetchCharacters,
  };
}
