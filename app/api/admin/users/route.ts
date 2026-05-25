import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 50,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const userIds = authData.users.map((user) => user.id);
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id, display_name, credits, tier, created_at")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const users = authData.users.map((user) => {
    const profile = profileById.get(user.id);
    return {
      id: user.id,
      email: user.email,
      display_name: profile?.display_name ?? null,
      credits: profile?.credits ?? 0,
      tier: profile?.tier ?? "free",
      created_at: profile?.created_at ?? user.created_at,
      last_sign_in_at: user.last_sign_in_at,
    };
  });

  return NextResponse.json({
    users,
    total: authData.users.length,
  });
}
