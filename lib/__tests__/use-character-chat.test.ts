/**
 * Tests for useCharacterChat thread hydration — restores history from
 * GET /api/agent/chat/[threadId] when a thread id is in localStorage or URL.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  useCharacterChat,
  talkThreadStorageKey,
  resolveThreadIdForHydration,
  writeTalkThreadId,
} from "@/lib/use-character-chat";

vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "tok", user: { user_metadata: { tenant_id: "t1" } } } },
      }),
    },
  }),
}));

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
  });
  vi.stubGlobal("fetch", vi.fn());
});

describe("resolveThreadIdForHydration", () => {
  it("prefers URL thread id over localStorage", () => {
    writeTalkThreadId("story-1", "char-a", "stored-thread");
    expect(resolveThreadIdForHydration("story-1", "char-a", "url-thread")).toBe("url-thread");
  });

  it("falls back to localStorage when no URL param", () => {
    writeTalkThreadId("story-1", "char-a", "stored-thread");
    expect(resolveThreadIdForHydration("story-1", "char-a")).toBe("stored-thread");
  });
});

describe("useCharacterChat hydration", () => {
  it("loads thread history from GET on mount when stored in localStorage", async () => {
    writeTalkThreadId("story-1", "char-a", "thread-abc");

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        threadId: "thread-abc",
        storyUid: "story-1",
        characterId: "char-a",
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there" },
        ],
      }),
    });

    const { result } = renderHook(() =>
      useCharacterChat("story-1", { characterId: "char-a" }),
    );

    await waitFor(() => {
      expect(result.current.hydrating).toBe(false);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/agent/chat/thread-abc",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(result.current.threadId).toBe("thread-abc");
    expect(result.current.messages).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ]);
  });

  it("uses initialThreadId from URL param instead of localStorage", async () => {
    writeTalkThreadId("story-1", "char-a", "ignored-thread");

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        threadId: "url-thread",
        storyUid: "story-1",
        characterId: "char-a",
        messages: [{ role: "user", content: "From URL" }],
      }),
    });

    const { result } = renderHook(() =>
      useCharacterChat("story-1", {
        characterId: "char-a",
        initialThreadId: "url-thread",
      }),
    );

    await waitFor(() => {
      expect(result.current.hydrating).toBe(false);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/agent/chat/url-thread",
      expect.any(Object),
    );
    expect(result.current.messages).toEqual([{ role: "user", content: "From URL" }]);
  });

  it("does not fetch when no thread id is available", async () => {
    const { result } = renderHook(() =>
      useCharacterChat("story-1", { characterId: "char-a" }),
    );

    await waitFor(() => {
      expect(result.current.hydrating).toBe(false);
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it("persists storage key per story and character", () => {
    expect(talkThreadStorageKey("story-1", "char-a")).toBe("sori-talk-thread:story-1:char-a");
  });
});
