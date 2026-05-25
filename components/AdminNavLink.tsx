import { ActiveLink } from "@/components/Navbar";
import { isAdminUser } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase/server";

export async function AdminNavLink() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    return null;
  }

  return <ActiveLink href="/admin">Admin</ActiveLink>;
}
