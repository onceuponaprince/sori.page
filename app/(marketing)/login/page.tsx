"use client";

import { Button } from "@/components/ui/button";
import { signInWithProvider } from "@/lib/auth";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-sm w-full space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            sori<span className="text-muted-foreground">.page</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            Sign in to start generating
          </p>
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full h-12 text-base"
            onClick={() => signInWithProvider("google")}
          >
            Continue with Google
          </Button>
          <Button
            variant="outline"
            className="w-full h-12 text-base"
            onClick={() => signInWithProvider("github")}
          >
            Continue with GitHub
          </Button>
          <Button
            variant="outline"
            className="w-full h-12 text-base"
            onClick={() => signInWithProvider("twitter")}
          >
            Continue with Twitter
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          5 free credits on signup. No credit card required.
        </p>

        <a
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-block"
        >
          Back to home
        </a>
      </div>
    </div>
  );
}
