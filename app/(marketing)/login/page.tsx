"use client";

import { Button } from "@/components/ui/button";
import { signInWithProvider } from "@/lib/auth";

export default function LoginPage() {
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

          <div className="mt-8 space-y-3">
            <Button
              variant="outline"
              className="w-full py-3"
              onClick={() => signInWithProvider("google")}
            >
              Continue with Google
            </Button>
            <Button
              variant="outline"
              className="w-full py-3"
              onClick={() => signInWithProvider("github")}
            >
              Continue with GitHub
            </Button>
            <Button
              variant="outline"
              className="w-full py-3"
              onClick={() => signInWithProvider("twitter")}
            >
              Continue with Twitter
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
