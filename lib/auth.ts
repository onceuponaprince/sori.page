"use client";

import { formatSupabaseAuthError } from "./auth-errors";
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

export async function signInWithEmail(email: string, password: string) {
  const supabase = createBrowserClient();
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
  } catch (error) {
    throw formatSupabaseAuthError(error);
  }
}

export async function signUpWithEmail(email: string, password: string) {
  const supabase = createBrowserClient();
  try {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) throw error;
  } catch (error) {
    throw formatSupabaseAuthError(error);
  }
}

export async function signInWithSuperAdmin(email: string, password: string) {
  const res = await fetch("/api/auth/super-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const payload = (await res.json().catch(() => null)) as {
    error?: string;
    warning?: string;
    devSession?: boolean;
  } | null;

  if (!res.ok) {
    throw new Error(payload?.error ?? "Super admin sign in failed");
  }

  if (payload?.warning) {
    console.warn(payload.warning);
  }
}

export async function signOut() {
  const supabase = createBrowserClient();
  await supabase.auth.signOut();
  window.location.href = "/";
}
