import type { User } from "@supabase/supabase-js";
import { requireAdminUser as requireAdminSessionUser } from "@/lib/session-user";

export async function requireAdmin(): Promise<User> {
  return requireAdminSessionUser();
}
