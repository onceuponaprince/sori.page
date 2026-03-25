import { NextRequest, NextResponse } from "next/server";
import { requireRequestContext } from "@/lib/request-context";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const context = await requireRequestContext(req);
    const supabase = createAdminClient();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", context.userId)
      .single();
    if (profileError) throw profileError;

    const { data: ledgerRows, error: ledgerError } = await supabase
      .from("credit_ledger")
      .select("amount")
      .eq("user_id", context.userId);
    if (ledgerError) throw ledgerError;

    const ledgerTotal = (ledgerRows ?? []).reduce((sum, row) => sum + (row.amount || 0), 0);
    const drift = (profile?.credits ?? 0) - (5 + ledgerTotal);

    return NextResponse.json({
      user_id: context.userId,
      cached_balance: profile?.credits ?? 0,
      ledger_total_from_signup_bonus: 5 + ledgerTotal,
      drift,
      ok: drift === 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reconciliation failed" },
      { status: 401 },
    );
  }
}
