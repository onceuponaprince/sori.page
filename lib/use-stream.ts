"use client";

import { useState, useCallback } from "react";
import type { AnalyzerResult } from "@/lib/analyzer-types";
import { createBrowserClient } from "@/lib/supabase/client";

interface StreamState {
  text: string;
  metadata: Record<string, unknown> | null;
  analysis: AnalyzerResult | null;
  statusHistory: string[];
  loading: boolean;
  error: string;
  done: boolean;
}

/**
 * Hook for consuming SSE streams from the generation API routes.
 * Handles streaming text, metadata, and error events.
 *
 * Usage:
 *   const { text, metadata, loading, error, done, generate } = useStream("/api/generate/beat");
 *   generate({ genre: "fantasy", beat_id: "the_ordeal" });
 */
export function useStream(endpoint: string) {
  const [state, setState] = useState<StreamState>({
    text: "",
    metadata: null,
    analysis: null,
    statusHistory: [],
    loading: false,
    error: "",
    done: false,
  });

  const generate = useCallback(
    async (params: Record<string, unknown>) => {
      setState({
        text: "",
        metadata: null,
        analysis: null,
        statusHistory: [],
        loading: true,
        error: "",
        done: false,
      });

      try {
        const supabase = createBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        const tenantId =
          (sessionData.session?.user?.user_metadata?.tenant_id as string | undefined) ||
          (sessionData.session?.user?.app_metadata?.tenant_id as string | undefined);

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }
        if (tenantId) {
          headers["X-Tenant-Id"] = tenantId;
        }

        const res = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(params),
        });

        if (!res.ok) {
          const data = await res.json();
          setState((s) => ({
            ...s,
            loading: false,
            error: data.error || "Generation failed",
          }));
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setState((s) => ({ ...s, loading: false, error: "No stream available" }));
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done: readerDone, value } = await reader.read();
          if (readerDone) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE incrementally so the hook works for both token-by-token
          // prose streams and structured analyzer event streams.
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6);
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr);

              switch (event.type) {
                case "metadata":
                  setState((s) => ({ ...s, metadata: event.metadata }));
                  break;
                case "status":
                  setState((s) => ({
                    ...s,
                    statusHistory: [...s.statusHistory, event.status],
                  }));
                  break;
                case "analysis":
                  setState((s) => ({ ...s, analysis: event.analysis }));
                  break;
                case "text":
                  setState((s) => ({ ...s, text: s.text + event.text }));
                  break;
                case "done":
                  setState((s) => ({ ...s, loading: false, done: true }));
                  break;
                case "error":
                  setState((s) => ({
                    ...s,
                    loading: false,
                    error: event.error,
                  }));
                  break;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }

        // Ensure we mark as done even if no explicit done event
        setState((s) => ({ ...s, loading: false, done: true }));
      } catch {
        setState((s) => ({
          ...s,
          loading: false,
          error: "Network error. Please try again.",
        }));
      }
    },
    [endpoint],
  );

  // Legacy generation routes still return prose + notes in one stream separated
  // by a marker. The analyzer path ignores these derived fields and uses
  // `analysis` / `statusHistory` instead.
  const marker = "---STRUCTURAL_NOTES---";
  const markerIdx = state.text.indexOf(marker);
  const mainContent =
    markerIdx > -1 ? state.text.slice(0, markerIdx).trim() : state.text;
  const structuralNotes =
    markerIdx > -1 ? state.text.slice(markerIdx + marker.length).trim() : "";
  const latestStatus =
    state.statusHistory.length > 0
      ? state.statusHistory[state.statusHistory.length - 1]
      : "";

  return {
    ...state,
    mainContent,
    structuralNotes,
    latestStatus,
    generate,
  };
}
