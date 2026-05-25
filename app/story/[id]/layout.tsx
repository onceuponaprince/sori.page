"use client";

import { use } from "react";
import { StoryTabNav } from "@/components/playground/StoryTabNav";
import { StoryBeatProvider } from "@/lib/story-beat-context";
import { StorySceneGoalProvider } from "@/lib/story-scene-goal-context";

export default function StoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <StoryBeatProvider storyUid={id}>
      <StorySceneGoalProvider>
        <div className="min-h-screen bg-background">
          <StoryTabNav storyUid={id} />
          {children}
        </div>
      </StorySceneGoalProvider>
    </StoryBeatProvider>
  );
}
