/**
 * Tests for useStoryCharacters() — the hook that pulls real
 * CharacterNode UIDs from the engine so the Multiverse Sidebar can
 * pass them to simulate_scene without slugifying display names.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useStoryCharacters } from "@/lib/use-story-characters";

vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "tok", user: { user_metadata: { tenant_id: "t1" } } } },
      }),
    },
  }),
}));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

describe("useStoryCharacters", () => {
  it("fetches and returns the characters payload", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        characters: [
          { id: "uid-maya", name: "Maya", roleHint: "protagonist", aliases: [] },
          { id: "uid-elias", name: "Elias", roleHint: "foil", aliases: ["Eli"] },
        ],
      }),
    });

    const { result } = renderHook(() => useStoryCharacters("story-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.characters).toHaveLength(2);
    expect(result.current.characters[0]).toEqual({
      id: "uid-maya",
      name: "Maya",
      roleHint: "protagonist",
      aliases: [],
    });
    expect(result.current.error).toBeNull();
  });

  it("calls the canonical endpoint path", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ characters: [] }),
    });

    renderHook(() => useStoryCharacters("story-xyz"));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    const calledWith = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledWith).toBe("/api/agent/characters/story-xyz");
  });

  it("returns empty list when storyUid is empty", async () => {
    const { result } = renderHook(() => useStoryCharacters(""));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.characters).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("captures backend error message", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ error: "Backend unavailable" }),
    });

    const { result } = renderHook(() => useStoryCharacters("story-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Backend unavailable");
    expect(result.current.characters).toEqual([]);
  });
});
