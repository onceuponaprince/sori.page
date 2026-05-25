"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { appendBeatToStoryDocument } from "@/lib/beat-insert";

export type BeatCreatedHandler = (
  beatId: string,
  summary: string,
  pattern: string,
) => void;

interface StoryBeatContextValue {
  registerBeatHandler: (handler: BeatCreatedHandler) => void;
  unregisterBeatHandler: () => void;
  notifyBeatCreated: (
    beatId: string,
    summary: string,
    pattern: string,
  ) => Promise<void>;
}

const StoryBeatContext = createContext<StoryBeatContextValue | null>(null);

export function StoryBeatProvider({
  storyUid,
  children,
}: {
  storyUid: string;
  children: ReactNode;
}) {
  const handlerRef = useRef<BeatCreatedHandler | null>(null);

  const registerBeatHandler = useCallback((handler: BeatCreatedHandler) => {
    handlerRef.current = handler;
  }, []);

  const unregisterBeatHandler = useCallback(() => {
    handlerRef.current = null;
  }, []);

  const notifyBeatCreated = useCallback(
    async (beatId: string, summary: string, pattern: string) => {
      if (handlerRef.current) {
        handlerRef.current(beatId, summary, pattern);
      } else {
        await appendBeatToStoryDocument(storyUid, summary, pattern);
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("story-beat-inserted", { detail: { beatId, storyUid } }),
        );
      }
    },
    [storyUid],
  );

  const value = useMemo(
    () => ({ registerBeatHandler, unregisterBeatHandler, notifyBeatCreated }),
    [registerBeatHandler, unregisterBeatHandler, notifyBeatCreated],
  );

  return (
    <StoryBeatContext.Provider value={value}>{children}</StoryBeatContext.Provider>
  );
}

export function useStoryBeat(): StoryBeatContextValue {
  const ctx = useContext(StoryBeatContext);
  if (!ctx) {
    throw new Error("useStoryBeat must be used within StoryBeatProvider");
  }
  return ctx;
}

export function useStoryBeatOptional(): StoryBeatContextValue | null {
  return useContext(StoryBeatContext);
}
