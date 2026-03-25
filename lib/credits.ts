import { createAdminClient } from "./supabase/admin";

export interface CreditCheck {
  allowed: boolean;
  remaining: number;
  error?: string;
}

export interface CreditReservationResult extends CreditCheck {
  reservationId?: number;
}

export async function reserveCredits(params: {
  userId: string;
  tenantId?: string | null;
  cost: number;
  operationKey: string;
  reason: string;
}): Promise<CreditReservationResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("reserve_credits", {
    p_user_id: params.userId,
    p_tenant_id: params.tenantId ?? null,
    p_amount: params.cost,
    p_operation_key: params.operationKey,
    p_reason: params.reason,
  });

  if (error || !data || data.length === 0) {
    return { allowed: false, remaining: 0, error: error?.message || "Credit reservation failed" };
  }

  const row = data[0] as {
    allowed: boolean;
    remaining: number;
    reservation_id: number | null;
    message: string | null;
  };

  return {
    allowed: row.allowed,
    remaining: row.remaining ?? 0,
    reservationId: row.reservation_id ?? undefined,
    error: row.message ?? undefined,
  };
}

export async function finalizeCreditReservation(params: {
  operationKey: string;
  success: boolean;
  generationId?: number | null;
  requestId?: string | null;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("finalize_credits", {
    p_operation_key: params.operationKey,
    p_success: params.success,
    p_generation_id: params.generationId ?? null,
    p_request_id: params.requestId ?? null,
  });
  if (error) {
    throw error;
  }
}

export async function grantCredits(params: {
  userId?: string | null;
  tenantId?: string | null;
  amount: number;
  reason: string;
  operationKey?: string | null;
  stripeEventId?: string | null;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("grant_credits", {
    p_user_id: params.userId ?? null,
    p_tenant_id: params.tenantId ?? null,
    p_amount: params.amount,
    p_reason: params.reason,
    p_operation_key: params.operationKey ?? null,
    p_stripe_event_id: params.stripeEventId ?? null,
  });
  if (error) {
    throw error;
  }
}

export async function getCreditBalance(params: {
  userId: string;
  tenantId?: string | null;
}): Promise<number> {
  const supabase = createAdminClient();
  if (params.tenantId) {
    const { data, error } = await supabase
      .from("tenants")
      .select("credit_balance")
      .eq("id", params.tenantId)
      .single();
    if (error || !data) throw new Error("Tenant not found");
    return data.credit_balance ?? 0;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", params.userId)
    .single();
  if (error || !data) throw new Error("User not found");
  return data.credits ?? 0;
}
