import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isAdminUser } from "@/lib/admin-auth";
import {
  DEV_SESSION_COOKIE,
  devSessionUserId,
  isDevSessionAllowed,
  verifyDevSessionToken,
} from "@/lib/dev-session";
import { createServerClient } from "@/lib/supabase/server";

function devSessionUser(email: string): User {
  return {
    id: devSessionUserId(email),
    aud: "authenticated",
    role: "authenticated",
    email,
    app_metadata: { role: "admin" },
    user_metadata: {},
    created_at: new Date(0).toISOString(),
  } as User;
}

export async function getSessionUser(): Promise<User | null> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return user;
    }
  } catch {
    // Supabase may be unreachable in local dev.
  }

  if (!isDevSessionAllowed()) {
    return null;
  }

  const cookieStore = await cookies();
  const email = await verifyDevSessionToken(
    cookieStore.get(DEV_SESSION_COOKIE)?.value,
  );
  return email ? devSessionUser(email) : null;
}

export async function requireAuthenticatedUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Authentication required");
  }
  return user;
}

export async function requireAdminUser(): Promise<User> {
  const user = await requireAuthenticatedUser();
  if (!isAdminUser(user)) {
    throw new Error("Admin access required");
  }
  return user;
}
