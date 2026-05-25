const DEFAULT_ENGINE_URL = "http://localhost:8001";

export function contextEngineBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || DEFAULT_ENGINE_URL;
}

export function formatBackendUnavailableError(): string {
  const url = contextEngineBaseUrl();
  return `Context engine unreachable at ${url}. Start the backend or verify NEXT_PUBLIC_API_URL.`;
}

export function isNetworkFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const cause = (error as Error & { cause?: unknown }).cause;
  const causeMessage =
    cause instanceof Error ? cause.message.toLowerCase() : "";

  return (
    message === "failed to fetch" ||
    message.includes("fetch failed") ||
    message.includes("networkerror") ||
    causeMessage.includes("getaddrinfo") ||
    causeMessage.includes("eai_again") ||
    causeMessage.includes("enotfound")
  );
}

export function formatSupabaseAuthError(error: unknown): Error {
  if (isNetworkFetchError(error)) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hint = supabaseUrl
      ? `Cannot reach Supabase at ${supabaseUrl}. Check the project is active and NEXT_PUBLIC_SUPABASE_URL is correct.`
      : "Cannot reach Supabase auth. Set NEXT_PUBLIC_SUPABASE_URL to an active Supabase project.";
    return new Error(hint);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Sign in failed");
}

export function formatAgentProxyError(error: unknown): string {
  if (error instanceof Error) {
    if (
      error.message === "Authentication required" ||
      error.message === "Invalid auth token" ||
      error.message === "Tenant access denied"
    ) {
      return error.message;
    }
  }

  return formatBackendUnavailableError();
}

export function isAuthContextError(message: string): boolean {
  return (
    message === "Authentication required" ||
    message === "Invalid auth token" ||
    message === "Tenant access denied"
  );
}

export function pickAuthError(
  primary: unknown,
  fallback: unknown,
): Error {
  if (primary instanceof Error && primary.message !== "Invalid credentials") {
    return formatSupabaseAuthError(primary);
  }

  return formatSupabaseAuthError(fallback);
}
