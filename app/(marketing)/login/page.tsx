"use client";

import { Button } from "@/components/ui/button";
import { signInWithProvider } from "@/lib/auth";

export default function LoginPage() {
  return (
    <div className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="sori-paper w-full max-w-md rounded-[2rem] p-7 sm:p-10">
          <div className="text-center">
            <p className="sori-kicker text-xs">welcome back</p>
            <h1 className="sori-title mt-3 text-4xl sm:text-5xl">
              sori<span className="text-muted-foreground">.page</span>
            </h1>
            <p className="mt-3 text-[var(--sori-text-secondary)]">
              Sign in to analyze structure, trace story logic, and write with
              gentle guidance.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <Button
              variant="outline"
              className="h-12 w-full text-base"
              onClick={() => signInWithProvider("google")}
            >
              Continue with Google
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full text-base"
              onClick={() => signInWithProvider("github")}
            >
              Continue with GitHub
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full text-base"
              onClick={() => signInWithProvider("twitter")}
            >
              Continue with Twitter
            </Button>
          </div>

          <div className="sori-panel mt-6 rounded-xl p-4 text-center">
            <p className="text-sm text-[var(--sori-text-secondary)]">
              5 free credits on signup. No credit card required.
            </p>
          </div>

          <div className="mt-6 text-center">
            <a
              href="/"
              className="sori-link-underline text-sm text-[var(--sori-text-secondary)]"
            >
              Back to home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
