import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";

async function signOutAction() {
  "use server";

  const supabase = await createServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.trim().charAt(0).toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}

export async function UserMenu() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Link
        href="/login"
        style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem", letterSpacing: "0.04em" }}
        className="border border-border px-4 py-2 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
      >
        Sign In
      </Link>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, credits")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    profile?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    "Account";
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url || null;
  const credits = profile?.credits ?? 0;
  const initials = getInitials(displayName);

  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-3 border border-border px-3 py-2">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={displayName} className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-[0.65rem]">
            {initials || "U"}
          </span>
        )}
        <div className="hidden text-left md:block">
          <p className="m-0 max-w-[11rem] truncate text-xs text-foreground">{displayName}</p>
          <p className="m-0 text-[0.65rem] text-muted-foreground">{credits} credits</p>
        </div>
      </summary>

      <div className="absolute right-0 mt-2 min-w-48 border border-border bg-card p-2 shadow-md">
        <Link
          href="/account"
          className="block px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Account
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Sign Out
          </button>
        </form>
      </div>
    </details>
  );
}
