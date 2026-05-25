"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { isInsufficientCreditsPayload } from "@/lib/credits";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  at?: string;
}

export interface UseCharacterChatOptions {
  characterId?: string | null;
  /** e.g. from `?thread_id=` URL param; takes precedence over localStorage */
  initialThreadId?: string | null;
}

export function talkThreadStorageKey(storyUid: string, characterId: string): string {
  return `sori-talk-thread:${storyUid}:${characterId}`;
}

export function readTalkThreadId(storyUid: string, characterId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(talkThreadStorageKey(storyUid, characterId));
}

export function writeTalkThreadId(
  storyUid: string,
  characterId: string,
  threadId: string | null,
): void {
  if (typeof window === "undefined") return;
  const key = talkThreadStorageKey(storyUid, characterId);
  if (threadId) window.localStorage.setItem(key, threadId);
  else window.localStorage.removeItem(key);
}

export function resolveThreadIdForHydration(
  storyUid: string,
  characterId: string,
  initialThreadId?: string | null,
): string | null {
  return initialThreadId ?? readTalkThreadId(storyUid, characterId);
}

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = createBrowserClient();
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  const tenantId =
    (session?.user?.user_metadata?.tenant_id as string | undefined) ||
    (session?.user?.app_metadata?.tenant_id as string | undefined);
  if (tenantId) headers["X-Tenant-Id"] = tenantId;
  return headers;
}

interface ThreadHistoryResponse {
  threadId: string;
  storyUid: string;
  characterId: string;
  messages: ChatMessage[];
}

export function useCharacterChat(storyUid: string, options: UseCharacterChatOptions = {}) {
  const { characterId, initialThreadId } = options;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creditBlocked, setCreditBlocked] = useState(false);

  useEffect(() => {
    if (!characterId) {
      setMessages([]);
      setThreadId(null);
      setHydrating(false);
      return;
    }

    const threadToLoad = resolveThreadIdForHydration(storyUid, characterId, initialThreadId);
    if (!threadToLoad) {
      setMessages([]);
      setThreadId(null);
      setHydrating(false);
      return;
    }

    let cancelled = false;
    setMessages([]);
    setThreadId(null);
    setHydrating(true);
    setError(null);

    void (async () => {
      try {
        const res = await fetch(`/api/agent/chat/${threadToLoad}`, {
          headers: await authHeaders(),
        });

        if (!res.ok) {
          if (res.status === 404) {
            writeTalkThreadId(storyUid, characterId, null);
          }
          return;
        }

        const data = (await res.json()) as ThreadHistoryResponse;
        if (cancelled) return;

        if (data.storyUid !== storyUid || data.characterId !== characterId) {
          writeTalkThreadId(storyUid, characterId, null);
          return;
        }

        setThreadId(data.threadId);
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        writeTalkThreadId(storyUid, characterId, data.threadId);
      } catch {
        // Hydration failure is non-fatal; user can start a fresh thread.
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storyUid, characterId, initialThreadId]);

  const sendMessage = useCallback(
    async (activeCharacterId: string, message: string) => {
      setLoading(true);
      setError(null);
      setCreditBlocked(false);
      setMessages((prev) => [...prev, { role: "user", content: message }]);

      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({
            story_uid: storyUid,
            character_id: activeCharacterId,
            message,
            thread_id: threadId,
          }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as
            | { error?: string; code?: string }
            | null;
          if (res.status === 402 || res.status === 403 || isInsufficientCreditsPayload(data)) {
            setCreditBlocked(true);
            throw new Error(
              data?.error ||
                "Not enough credits. Upgrade your plan on the Account page to continue.",
            );
          }
          throw new Error(data?.code || data?.error || `Chat failed: ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No stream available");

        const decoder = new TextDecoder();
        let buffer = "";
        let assistantText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const event = JSON.parse(line.slice(6)) as {
              type: string;
              text?: string;
              threadId?: string;
              assistantMessage?: string;
              error?: string;
            };

            if (event.type === "thread" && event.threadId) {
              setThreadId(event.threadId);
              writeTalkThreadId(storyUid, activeCharacterId, event.threadId);
            }
            if (event.type === "text" && event.text) {
              assistantText += event.text;
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  next[next.length - 1] = { ...last, content: assistantText };
                } else {
                  next.push({ role: "assistant", content: assistantText });
                }
                return next;
              });
            }
            if (event.type === "error") {
              throw new Error(event.error || "Chat error");
            }
            if (event.type === "done" && event.assistantMessage && !assistantText) {
              assistantText = event.assistantMessage;
              setMessages((prev) => [...prev, { role: "assistant", content: assistantText }]);
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Chat failed");
      } finally {
        setLoading(false);
      }
    },
    [storyUid, threadId],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setThreadId(null);
    setError(null);
    setCreditBlocked(false);
  }, []);

  return {
    messages,
    threadId,
    loading,
    hydrating,
    error,
    creditBlocked,
    sendMessage,
    reset,
  };
}
