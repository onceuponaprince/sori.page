"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { StoryAccountLink } from "@/components/playground/StoryAccountLink";
import { usePlaygroundCharacters } from "@/lib/use-playground-characters";

const TABS = [
  { segment: "", label: "Editor" },
  { segment: "characters", label: "Characters" },
  { segment: "talk", label: "Talk" },
  { segment: "scene", label: "Scene" },
  { segment: "timeline", label: "Timeline" },
] as const;

interface StoryTabNavProps {
  storyUid: string;
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

export function StoryTabNav({ storyUid }: StoryTabNavProps) {
  const pathname = usePathname();
  const { publishedCharacters, loading } = usePlaygroundCharacters(storyUid, {
    publishedOnly: true,
  });
  const hasPublished = publishedCharacters.length > 0;
  const [storyTitle, setStoryTitle] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTitle() {
      try {
        const response = await fetch(`/api/story/${storyUid}/document`, {
          headers: await buildAuthHeaders(),
          cache: "no-store",
        });
        if (!response.ok) return;

        const payload = (await response.json()) as { title?: string };
        if (!cancelled && payload.title?.trim()) {
          setStoryTitle(payload.title.trim());
        }
      } catch {
        // Title is optional chrome; fall back to uid chip.
      }
    }

    void loadTitle();

    return () => {
      cancelled = true;
    };
  }, [storyUid]);

  return (
    <header className="border-b border-border bg-card px-4 py-3 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Link
            href="/stories"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Stories
          </Link>
          <span className="hidden text-muted-foreground sm:inline">|</span>
          <div className="min-w-0">
            <p
              style={{ fontFamily: "var(--font-display)", fontSize: "1rem" }}
              className="truncate font-medium text-foreground"
            >
              {storyTitle || "Untitled story"}
            </p>
            <span className="sori-chip mt-1 inline-block px-2 py-0.5 text-xs">
              {storyUid.slice(0, 8)}
            </span>
          </div>
        </div>
        <StoryAccountLink />
      </div>

      <nav className="mt-3 flex flex-wrap gap-1">
        {TABS.map(({ segment, label }) => {
          const href = segment
            ? `/story/${storyUid}/${segment}`
            : `/story/${storyUid}`;
          const active = segment
            ? pathname.startsWith(href)
            : pathname === href || pathname === `${href}/`;
          const needsPublish = (segment === "talk" || segment === "scene") && !hasPublished;
          const disabled = needsPublish && !loading;

          return (
            <Link
              key={segment || "editor"}
              href={disabled ? "#" : href}
              aria-disabled={disabled}
              className={`px-3 py-1.5 text-sm transition-colors border ${
                active
                  ? "border-foreground bg-foreground text-background"
                  : disabled
                    ? "border-border text-muted-foreground cursor-not-allowed opacity-50"
                    : "border-border text-foreground hover:border-accent"
              }`}
              onClick={(e) => {
                if (disabled) e.preventDefault();
              }}
              title={
                disabled
                  ? "Publish at least one character in the Characters tab first"
                  : undefined
              }
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
