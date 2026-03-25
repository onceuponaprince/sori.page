import { NextRequest, NextResponse } from "next/server";
import { requireRequestContext } from "@/lib/request-context";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const context = await requireRequestContext(req);
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = Math.min(100, Math.max(1, Number(limitParam || 25)));

    const supabase = createAdminClient();
    const query = supabase
      .from("credit_ledger")
      .select("id, amount, entry_type, reason, operation_key, request_id, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    const { data, error } = context.tenantId
      ? await query.eq("tenant_id", context.tenantId)
      : await query.eq("user_id", context.userId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ entries: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch history" },
      { status: 401 },
    );
  }
}
