import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSuperAdminConfig,
  superAdminCredentialsMatch,
} from "@/lib/admin-auth";
import {
  devSessionCookieOptions,
  isDevSessionAllowed,
  isSupabaseNetworkError,
} from "@/lib/dev-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

async function findUserByEmail(admin: SupabaseClient, email: string) {
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === email,
    );
    if (match) {
      return match;
    }

    if (data.users.length < perPage) {
      break;
    }
    page += 1;
  }

  return null;
}

async function ensureSuperAdminUser(email: string, password: string) {
  const admin = createAdminClient();
  const existing = await findUserByEmail(admin, email);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata: {
        ...existing.app_metadata,
        role: "admin",
      },
    });
    if (error) {
      throw error;
    }
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "admin" },
  });
  if (error) {
    throw error;
  }

  return data.user.id;
}

export async function POST(req: NextRequest) {
  const { enabled } = getSuperAdminConfig();
  if (!enabled) {
    return NextResponse.json(
      { error: "Super admin bypass is disabled" },
      { status: 403 },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "email and password are required" },
      { status: 400 },
    );
  }

  if (!superAdminCredentialsMatch(email, password)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  try {
    await ensureSuperAdminUser(email, password);
  } catch (error) {
    if (isDevSessionAllowed() && isSupabaseNetworkError(error)) {
      const response = NextResponse.json({
        ok: true,
        devSession: true,
        warning:
          "Supabase is unreachable; using local dev session. Update NEXT_PUBLIC_SUPABASE_URL for full auth.",
      });
      response.cookies.set(await devSessionCookieOptions(email));
      return response;
    }

    const message =
      error instanceof Error
        ? isSupabaseNetworkError(error)
          ? "Cannot reach Supabase. Verify NEXT_PUBLIC_SUPABASE_URL points to an active project."
          : error.message
        : "Could not provision super admin user";

    return NextResponse.json({ error: message }, { status: 500 });
  }

  const supabase = await createServerClient();
  try {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return NextResponse.json({ error: signInError.message }, { status: 401 });
    }
  } catch (error) {
    if (isDevSessionAllowed() && isSupabaseNetworkError(error)) {
      const response = NextResponse.json({
        ok: true,
        devSession: true,
        warning:
          "Supabase sign-in failed; using local dev session. Update NEXT_PUBLIC_SUPABASE_URL for full auth.",
      });
      response.cookies.set(await devSessionCookieOptions(email));
      return response;
    }

    const message = isSupabaseNetworkError(error)
      ? "Cannot reach Supabase. Verify NEXT_PUBLIC_SUPABASE_URL points to an active project."
      : error instanceof Error
        ? error.message
        : "Super admin sign in failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
