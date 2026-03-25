"use client";

import { createBrowserClient } from "./supabase/client";
import type { Provider } from "@supabase/supabase-js";

export async function signInWithProvider(provider: Provider) {
  const supabase = createBrowserClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const supabase = createBrowserClient();
  await supabase.auth.signOut();
  window.location.href = "/";
}
