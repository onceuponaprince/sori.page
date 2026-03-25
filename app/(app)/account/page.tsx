import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username, avatar_url, credits, tier, created_at")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="mb-8">
        <p className="sori-kicker">account</p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.6rem",
            fontWeight: 500,
          }}
          className="mt-2 text-foreground"
        >
          Account Settings
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.85rem",
            color: "#8A857E",
            lineHeight: 1.7,
          }}
          className="mt-2"
        >
          Review your profile and plan details.
        </p>
      </div>

      <section className="border border-border bg-card p-5 md:p-6">
        <dl className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Email</dt>
            <dd className="mt-1 text-foreground">{user.email ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Display Name</dt>
            <dd className="mt-1 text-foreground">{profile?.display_name || "Not set"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Username</dt>
            <dd className="mt-1 text-foreground">{profile?.username || "Not set"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Credits</dt>
            <dd className="mt-1 text-foreground">{profile?.credits ?? 0}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Tier</dt>
            <dd className="mt-1 text-foreground">{profile?.tier ?? "free"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Member Since</dt>
            <dd className="mt-1 text-foreground">
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString()
                : "-"}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
