"use client";

/**
 * /story/[id] — story-scoped editor entry point.
 *
 * Mounts the same SoriEditor used at /write but pins it to the
 * storyUid from the URL. This is the destination for the timeline's
 * click-to-resume deep link, which appends `?resumeNode=<uid>` so the
 * Multiverse Sidebar can highlight the right branch on landing.
 */

import { use } from "react";
import { SoriEditor } from "@/components/editor/SoriEditor";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function StoryEditorPage({ params }: PageProps) {
  const { id } = use(params);
  return <SoriEditor storyUid={id} />;
}
