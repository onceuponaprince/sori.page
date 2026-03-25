import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export async function getOrCreateStripeCustomer(params: {
  userId: string;
  tenantId?: string | null;
  email?: string | null;
}) {
  const supabase = createAdminClient();
  const stripe = getStripe();

  const { data: existing } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq(params.tenantId ? "tenant_id" : "user_id", params.tenantId ?? params.userId)
    .maybeSingle();

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email: params.email ?? undefined,
    metadata: {
      user_id: params.userId,
      ...(params.tenantId ? { tenant_id: params.tenantId } : {}),
    },
  });

  const { error } = await supabase.from("billing_customers").insert({
    user_id: params.tenantId ? null : params.userId,
    tenant_id: params.tenantId ?? null,
    stripe_customer_id: customer.id,
  });
  if (error) {
    throw error;
  }

  return customer.id;
}
