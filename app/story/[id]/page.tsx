"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SoriEditor } from "@/components/editor/SoriEditor";
import { usePlaygroundCharacters } from "@/lib/use-playground-characters";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function StoryEditorPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { allCharacters, loading } = usePlaygroundCharacters(id);

  useEffect(() => {
    if (loading) return;
    if (allCharacters.length === 0) {
      router.replace(`/story/${id}/characters`);
    }
  }, [allCharacters.length, id, loading, router]);

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading story…</div>;
  }

  if (allCharacters.length === 0) {
    return null;
  }

  return <SoriEditor storyUid={id} />;
}
