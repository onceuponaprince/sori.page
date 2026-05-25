"use client";

import { useRouter } from "next/navigation";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { useStorySceneGoalOptional } from "@/lib/story-scene-goal-context";

interface UseAsSceneGoalButtonProps {
  editor: Editor | null;
  storyUid: string;
  selectedText: string;
}

export function UseAsSceneGoalButton({
  editor,
  storyUid,
  selectedText,
}: UseAsSceneGoalButtonProps) {
  const router = useRouter();
  const sceneGoalContext = useStorySceneGoalOptional();

  const hasSelection = selectedText.length > 0;

  function handleUseAsSceneGoal() {
    if (!editor || !hasSelection || !sceneGoalContext) return;

    sceneGoalContext.setPendingSceneGoal(selectedText);
    router.push(`/story/${storyUid}/scene`);
  }

  if (!sceneGoalContext) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleUseAsSceneGoal}
      disabled={!editor || !hasSelection}
      title={
        hasSelection
          ? "Send selected text to the Scene tab as the simulation goal"
          : "Select text in the editor first"
      }
    >
      Use as scene goal
    </Button>
  );
}
