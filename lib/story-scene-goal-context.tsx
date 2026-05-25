"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface StorySceneGoalContextValue {
  /** Ephemeral goal text sent from the Editor; consumed by ScenePanel. */
  pendingSceneGoal: string | null;
  setPendingSceneGoal: (goal: string) => void;
  clearPendingSceneGoal: () => void;
}

const StorySceneGoalContext = createContext<StorySceneGoalContextValue | null>(
  null,
);

export function StorySceneGoalProvider({ children }: { children: ReactNode }) {
  const [pendingSceneGoal, setPendingGoal] = useState<string | null>(null);

  const setPendingSceneGoal = useCallback((goal: string) => {
    setPendingGoal(goal.trim() || null);
  }, []);

  const clearPendingSceneGoal = useCallback(() => {
    setPendingGoal(null);
  }, []);

  const value = useMemo(
    () => ({ pendingSceneGoal, setPendingSceneGoal, clearPendingSceneGoal }),
    [pendingSceneGoal, setPendingSceneGoal, clearPendingSceneGoal],
  );

  return (
    <StorySceneGoalContext.Provider value={value}>
      {children}
    </StorySceneGoalContext.Provider>
  );
}

export function useStorySceneGoal(): StorySceneGoalContextValue {
  const ctx = useContext(StorySceneGoalContext);
  if (!ctx) {
    throw new Error(
      "useStorySceneGoal must be used within StorySceneGoalProvider",
    );
  }
  return ctx;
}

export function useStorySceneGoalOptional(): StorySceneGoalContextValue | null {
  return useContext(StorySceneGoalContext);
}
