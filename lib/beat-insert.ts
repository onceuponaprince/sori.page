import type { JSONContent } from "@tiptap/core";
import { createBrowserClient } from "@/lib/supabase/client";

export function buildBeatContent(summary: string, pattern: string): JSONContent[] {
  return [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          marks: [{ type: "bold" }],
          text: `[Beat: ${pattern}] `,
        },
        { type: "text", text: summary },
      ],
    },
    { type: "paragraph" },
  ];
}

async function buildStoryAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createBrowserClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const accessToken = session?.access_token;
  const tenantId =
    (session?.user?.user_metadata?.tenant_id as string | undefined) ||
    (session?.user?.app_metadata?.tenant_id as string | undefined);

  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (tenantId) headers["X-Tenant-Id"] = tenantId;

  return headers;
}

export async function appendBeatToStoryDocument(
  storyUid: string,
  summary: string,
  pattern: string,
): Promise<void> {
  const headers = await buildStoryAuthHeaders();

  const response = await fetch(`/api/story/${storyUid}/document`, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load story document for beat insert");
  }

  const payload = (await response.json()) as {
    editorDocument?: JSONContent | null;
    editorPreset?: string;
  };

  const existingDoc = payload.editorDocument ?? { type: "doc", content: [] };
  const content = [...(existingDoc.content ?? []), ...buildBeatContent(summary, pattern)];

  const saveResponse = await fetch(`/api/story/${storyUid}/document`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      editor_document: { ...existingDoc, content },
      editor_preset: payload.editorPreset ?? "novel",
    }),
  });

  if (!saveResponse.ok) {
    throw new Error("Failed to save beat to story document");
  }
}
