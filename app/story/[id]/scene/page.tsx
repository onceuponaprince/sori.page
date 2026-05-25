"use client";

import { use, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ScenePanel } from "@/components/playground/ScenePanel";
import { usePlaygroundCharacters } from "@/lib/use-playground-characters";
import { useStorySceneGoal } from "@/lib/story-scene-goal-context";

export default function StoryScenePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const resumeNodeUid = searchParams.get("resumeNode");
  const sceneGoalParam = searchParams.get("sceneGoal");
  const { setPendingSceneGoal } = useStorySceneGoal();

  useEffect(() => {
    if (sceneGoalParam) {
      setPendingSceneGoal(sceneGoalParam);
    }
  }, [sceneGoalParam, setPendingSceneGoal]);

  const { characters: publishedCharacters, loading, error } = usePlaygroundCharacters(id, {
    publishedOnly: true,
  });

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading scene workspace…</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-sm text-red-600" role="alert">
        {error}
      </div>
    );
  }

  if (publishedCharacters.length === 0) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Publish at least one character in the Characters tab to run a scene.
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-57px)]">
      <ScenePanel
        storyUid={id}
        publishedCharacters={publishedCharacters}
        resumeNodeUid={resumeNodeUid}
      />
    </div>
  );
}
