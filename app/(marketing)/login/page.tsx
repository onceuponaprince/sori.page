import { Suspense } from "react";
import { LoginContent } from "./login-content";

function LoginFallback() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
        <div className="w-full max-w-md border border-border bg-card p-7 sm:p-10">
          <div className="animate-pulse space-y-4">
            <div className="mx-auto h-4 w-24 rounded bg-muted" />
            <div className="mx-auto h-10 w-48 rounded bg-muted" />
            <div className="mx-auto h-12 w-full rounded bg-muted" />
            <div className="mx-auto h-12 w-full rounded bg-muted" />
            <div className="mx-auto h-12 w-full rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
