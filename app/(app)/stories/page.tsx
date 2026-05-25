"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

interface StoryListItem {
  storyUid: string;
  title: string;
  status?: string;
  updatedAt?: string | null;
}

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

export default function StoriesPage() {
  const [stories, setStories] = useState<StoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/agent/story", {
          headers: await buildAuthHeaders(),
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`Failed to load stories (${res.status})`);
        }
        const data = (await res.json()) as { stories?: StoryListItem[] };
        if (!cancelled) {
          setStories(Array.isArray(data.stories) ? data.stories : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load stories");
          setStories([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="sori-kicker">Your stories</p>
          <h1
            style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem" }}
            className="mt-1 font-medium"
          >
            Stories
          </h1>
        </div>
        <Link
          href="/story/new"
          className="border border-accent px-4 py-2 text-sm text-accent transition-colors hover:bg-accent hover:text-white"
        >
          New story
        </Link>
      </div>

      {loading && (
        <p className="mt-10 text-sm text-muted-foreground">Loading stories…</p>
      )}

      {error && (
        <p className="mt-10 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && stories.length === 0 && (
        <div className="mt-10 border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No stories yet. Create one to use the simulation playground.
          </p>
          <Link
            href="/story/new"
            className="mt-4 inline-block border border-accent px-4 py-2 text-sm text-accent hover:bg-accent hover:text-white"
          >
            Create your first story
          </Link>
        </div>
      )}

      {!loading && stories.length > 0 && (
        <ul className="mt-8 divide-y divide-border border border-border bg-card">
          {stories.map((story) => (
            <li key={story.storyUid}>
              <Link
                href={`/story/${story.storyUid}`}
                className="flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-muted/40"
              >
                <div>
                  <p className="font-medium text-foreground">{story.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {story.storyUid.slice(0, 8)}
                    {story.status ? ` · ${story.status.replace("_", " ")}` : ""}
                  </p>
                </div>
                <span className="text-xs text-accent">Open →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
