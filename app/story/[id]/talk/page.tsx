"use client";

import { use } from "react";
import { TalkPanel } from "@/components/playground/TalkPanel";
import { usePlaygroundCharacters } from "@/lib/use-playground-characters";

export default function StoryTalkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: storyUid } = use(params);
  const { characters, loading, error } = usePlaygroundCharacters(storyUid, {
    publishedOnly: true,
  });

  if (loading) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Loading…</div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-sm text-red-600" role="alert">
        {error}
      </div>
    );
  }

  return <TalkPanel storyUid={storyUid} publishedCharacters={characters} />;
}
