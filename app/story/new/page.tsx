"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

const STORAGE_KEY = "sori-treehouse-draft-v1";

async function buildAuthHeaders(): Promise<Record<string, string>> {
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

function readLocalDraft(): {
  title: string;
  editorJson: Record<string, unknown> | null;
  editorPreset: string | null;
} {
  if (typeof window === "undefined") {
    return { title: "Untitled Story", editorJson: null, editorPreset: null };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { title: "Untitled Story", editorJson: null, editorPreset: null };
  }

  try {
    const parsed = JSON.parse(raw) as {
      title?: string;
      editorJson?: Record<string, unknown>;
      editorPreset?: string;
    };
    return {
      title: parsed.title?.trim() || "Untitled Story",
      editorJson: parsed.editorJson ?? null,
      editorPreset: parsed.editorPreset ?? null,
    };
  } catch {
    return { title: "Untitled Story", editorJson: null, editorPreset: null };
  }
}

export default function NewStoryPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function createStory() {
      try {
        const draft = readLocalDraft();
        const headers = await buildAuthHeaders();

        const createRes = await fetch("/api/agent/story", {
          method: "POST",
          headers,
          body: JSON.stringify({ title: draft.title }),
        });

        if (!createRes.ok) {
          const payload = (await createRes.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error || `Create failed: ${createRes.status}`);
        }

        const created = (await createRes.json()) as { storyUid?: string; uid?: string };
        const storyUid = created.storyUid || created.uid;
        if (!storyUid) {
          throw new Error("Story created without an id");
        }

        if (draft.editorJson) {
          await fetch(`/api/story/${storyUid}/document`, {
            method: "PUT",
            headers,
            body: JSON.stringify({
              editor_document: draft.editorJson,
              ...(draft.editorPreset === "novel" || draft.editorPreset === "script"
                ? { editor_preset: draft.editorPreset }
                : {}),
            }),
          });
        }

        if (!cancelled) {
          router.replace(`/story/${storyUid}`);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not create story");
        }
      }
    }

    void createStory();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
        <Link
          href="/write"
          className="border border-border px-4 py-2 text-sm text-foreground hover:border-accent"
        >
          Back to editor
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
      Creating your story…
    </div>
  );
}
