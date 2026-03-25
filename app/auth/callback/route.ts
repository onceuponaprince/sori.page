import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * OAuth callback handler.
 * Supabase redirects here after social login. We exchange the code
 * for a session and redirect to the app.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const redirectPath =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/generate";

  if (code) {
    try {
      const supabase = await createServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        throw error;
      }
    } catch {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("error", "auth_callback_failed");
      if (next) {
        loginUrl.searchParams.set("next", next);
      }
      return NextResponse.redirect(loginUrl);
    }
  } else {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("error", "missing_auth_code");
    if (next) {
      loginUrl.searchParams.set("next", next);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL(redirectPath, req.url));
}
