"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { PlaygroundCharacter } from "@/types/character";

async function buildAuthHeaders(): Promise<Record<string, string>> {
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

export type UsePlaygroundCharactersOptions = {
  /** When true, `characters` in the return value lists published rows only. */
  publishedOnly?: boolean;
};

export function usePlaygroundCharacters(
  storyUid: string,
  options: UsePlaygroundCharactersOptions = {},
) {
  const { publishedOnly = false } = options;
  const [characters, setCharacters] = useState<PlaygroundCharacter[]>([]);
  const [loading, setLoading] = useState(Boolean(storyUid));
  const [error, setError] = useState<string | null>(null);

  const publishedCharacters = useMemo(
    () => characters.filter((c) => c.isPublished),
    [characters],
  );

  const visibleCharacters = publishedOnly ? publishedCharacters : characters;

  const refresh = useCallback(async () => {
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
        throw new Error(payload?.error || `Fetch failed: ${res.status}`);
      }
      const data = (await res.json()) as { characters: PlaygroundCharacter[] };
      setCharacters(Array.isArray(data.characters) ? data.characters : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load characters");
      setCharacters([]);
    } finally {
      setLoading(false);
    }
  }, [storyUid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createCharacter = useCallback(
    async (name: string) => {
      const res = await fetch(`/api/agent/characters/${storyUid}`, {
        method: "POST",
        headers: await buildAuthHeaders(),
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error || `Create failed: ${res.status}`);
      }
      await refresh();
      return (await res.json()) as PlaygroundCharacter;
    },
    [storyUid, refresh],
  );

  const saveDraft = useCallback(
    async (charId: string, source: string, expectedRevision?: number) => {
      const res = await fetch(
        `/api/agent/characters/${storyUid}/${charId}/draft`,
        {
          method: "PUT",
          headers: await buildAuthHeaders(),
          body: JSON.stringify({ source, expected_revision: expectedRevision }),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error || `Save failed: ${res.status}`);
      }
      await refresh();
      return (await res.json()) as PlaygroundCharacter;
    },
    [storyUid, refresh],
  );

  const fetchCharacter = useCallback(
    async (charId: string) => {
      const res = await fetch(`/api/agent/characters/${storyUid}/${charId}`, {
        headers: await buildAuthHeaders(),
        cache: "no-store",
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string; code?: string }
          | null;
        throw new Error(payload?.error || payload?.code || `Fetch failed: ${res.status}`);
      }
      const character = (await res.json()) as PlaygroundCharacter;
      setCharacters((prev) =>
        prev.map((c) => (c.id === charId ? character : c)),
      );
      return character;
    },
    [storyUid],
  );

  const deleteCharacter = useCallback(
    async (charId: string) => {
      const res = await fetch(`/api/agent/characters/${storyUid}/${charId}`, {
        method: "DELETE",
        headers: await buildAuthHeaders(),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string; code?: string }
          | null;
        const code = payload?.code;
        if (code === "PUBLISHED") {
          throw new Error("Cannot delete a published character");
        }
        throw new Error(payload?.error || code || `Delete failed: ${res.status}`);
      }
      setCharacters((prev) => prev.filter((c) => c.id !== charId));
    },
    [storyUid],
  );

  const publishCharacter = useCallback(
    async (charId: string, expectedRevision?: number) => {
      const res = await fetch(
        `/api/agent/characters/${storyUid}/${charId}/publish`,
        {
          method: "POST",
          headers: await buildAuthHeaders(),
          body: JSON.stringify({ expected_revision: expectedRevision }),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string; code?: string }
          | null;
        throw new Error(payload?.code || payload?.error || `Publish failed: ${res.status}`);
      }
      await refresh();
      return await res.json();
    },
    [storyUid, refresh],
  );

  const submitComponent = useCallback(
    async (source: string, filename?: string) => {
      const res = await fetch(`/api/agent/characters/${storyUid}/component`, {
        method: "POST",
        headers: await buildAuthHeaders(),
        body: JSON.stringify({ source, filename }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string; code?: string }
          | null;
        throw new Error(payload?.error || payload?.code || `Submit failed: ${res.status}`);
      }
      await refresh();
      return (await res.json()) as PlaygroundCharacter;
    },
    [storyUid, refresh],
  );

  return {
    characters: visibleCharacters,
    allCharacters: characters,
    publishedCharacters,
    loading,
    error,
    refresh,
    createCharacter,
    fetchCharacter,
    deleteCharacter,
    saveDraft,
    publishCharacter,
    submitComponent,
  };
}
