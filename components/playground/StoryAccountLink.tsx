"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export function StoryAccountLink() {
  const [credits, setCredits] = useState<number | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const supabase = createBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (!user) {
          setSignedIn(false);
          setCredits(null);
          return;
        }

        setSignedIn(true);

        const { data: profile } = await supabase
          .from("profiles")
          .select("credits")
          .eq("id", user.id)
          .maybeSingle();

        if (!cancelled) {
          setCredits(profile?.credits ?? 0);
        }
      } catch {
        if (!cancelled) {
          setSignedIn(false);
          setCredits(null);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (signedIn === false) {
    return (
      <Link
        href="/login"
        className="border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
      >
        Sign in
      </Link>
    );
  }

  return (
    <Link
      href="/account"
      className="border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
    >
      {credits !== null ? `${credits} credits · Account` : "Account"}
    </Link>
  );
}
