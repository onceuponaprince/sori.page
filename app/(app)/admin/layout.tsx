import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/admin-auth";
import { getSessionUser } from "@/lib/session-user";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  if (!isAdminUser(user)) {
    redirect("/login?next=/admin&error=admin_required");
  }

  return children;
}
