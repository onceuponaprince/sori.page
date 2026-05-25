"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { Provider } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pickAuthError } from "@/lib/auth-errors";
import {
  signInWithEmail,
  signInWithProvider,
  signInWithSuperAdmin,
  signUpWithEmail,
} from "@/lib/auth";

const SUPER_ADMIN_BYPASS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_SUPER_ADMIN_BYPASS === "true";

type AuthMode = "signin" | "signup";

function getRedirectPath(next: string | null) {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/write";
}

export function LoginContent() {
  const searchParams = useSearchParams();
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [submittingEmail, setSubmittingEmail] = useState(false);

  useEffect(() => {
    const error = searchParams.get("error");
    if (!error) {
      return;
    }

    if (error === "auth_callback_failed") {
      toast.error("Could not complete sign in. Please try again.");
      return;
    }

    if (error === "missing_auth_code") {
      toast.error("Sign in was cancelled or expired. Please try again.");
      return;
    }

    if (error === "admin_required") {
      toast.error("Admin access is required for that page.");
      return;
    }

    toast.error("Sign in failed. Please try again.");
  }, [searchParams]);

  async function handleProviderSignIn(provider: Provider) {
    setLoadingProvider(provider);
    try {
      await signInWithProvider(provider);
    } catch (error) {
      setLoadingProvider(null);
      toast.error(error instanceof Error ? error.message : "Sign in failed");
    }
  }

  async function handleEmailAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingEmail(true);

    const redirectPath = getRedirectPath(searchParams.get("next"));

    try {
      if (authMode === "signup") {
        await signUpWithEmail(email, password);
        toast.success("Account created. Check your email if confirmation is required.");
        window.location.href = redirectPath;
        return;
      }

      if (SUPER_ADMIN_BYPASS_ENABLED) {
        try {
          await signInWithSuperAdmin(email, password);
          window.location.href = redirectPath;
          return;
        } catch (superAdminError) {
          if (
            superAdminError instanceof Error &&
            superAdminError.message === "Invalid credentials"
          ) {
            await signInWithEmail(email, password);
          } else {
            throw superAdminError;
          }
        }
      } else {
        try {
          await signInWithEmail(email, password);
        } catch (signInError) {
          try {
            await signInWithSuperAdmin(email, password);
          } catch (superAdminError) {
            throw pickAuthError(superAdminError, signInError);
          }
        }
      }

      window.location.href = redirectPath;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setSubmittingEmail(false);
    }
  }

  const authBusy = loadingProvider !== null || submittingEmail;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
        <div className="w-full max-w-md border border-border bg-card p-7 sm:p-10">
          <div className="text-center">
            <p className="sori-kicker">welcome back</p>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem, 4vw, 2.5rem)", fontWeight: 500 }} className="mt-3 text-foreground">
              sori<span style={{ color: "#8A857E" }}>.page</span>
            </h1>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "#8A857E", lineHeight: 1.7 }} className="mt-3">
              Sign in to analyze structure, trace story logic, and write with
              gentle guidance.
            </p>
          </div>

          <form className="mt-8 space-y-3" onSubmit={handleEmailAuth}>
            <Input
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={authBusy}
            />
            <Input
              type="password"
              autoComplete={authMode === "signup" ? "new-password" : "current-password"}
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              disabled={authBusy}
            />
            <Button type="submit" className="w-full py-3" disabled={authBusy}>
              {submittingEmail
                ? authMode === "signup"
                  ? "Creating account..."
                  : "Signing in..."
                : authMode === "signup"
                  ? "Create account"
                  : "Sign in with email"}
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              disabled={authBusy}
              onClick={() =>
                setAuthMode((mode) => (mode === "signin" ? "signup" : "signin"))
              }
            >
              {authMode === "signin"
                ? "Need an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem", color: "#8A857E" }}>
              or continue with
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full py-3"
              disabled={authBusy}
              onClick={() => handleProviderSignIn("google")}
            >
              {loadingProvider === "google" ? "Connecting to Google..." : "Continue with Google"}
            </Button>
            <Button
              variant="outline"
              className="w-full py-3"
              disabled={authBusy}
              onClick={() => handleProviderSignIn("github")}
            >
              {loadingProvider === "github" ? "Connecting to GitHub..." : "Continue with GitHub"}
            </Button>
            <Button
              variant="outline"
              className="w-full py-3"
              disabled={authBusy}
              onClick={() => handleProviderSignIn("twitter")}
            >
              {loadingProvider === "twitter" ? "Connecting to Twitter..." : "Continue with Twitter"}
            </Button>
          </div>

          <div className="mt-6 border border-border p-4 text-center">
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E" }}>
              5 free credits on signup. No credit card required.
            </p>
          </div>

          <div className="mt-6 text-center">
            <a
              href="/"
              style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem" }}
              className="text-accent underline underline-offset-4 hover:text-foreground transition-colors"
            >
              Back to home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
