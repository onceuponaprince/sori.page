import { NextRequest, NextResponse } from "next/server";
import { requireRequestContext } from "@/lib/request-context";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const context = await requireRequestContext(req);
    const rate = checkRateLimit(
      `billing_portal:${context.tenantId ?? "user"}:${context.tenantId ?? context.userId}`,
    );
    if (!rate.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const supabase = createAdminClient();
    const { data: customer } = await supabase
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq(context.tenantId ? "tenant_id" : "user_id", context.tenantId ?? context.userId)
      .maybeSingle();

    if (!customer?.stripe_customer_id) {
      return NextResponse.json({ error: "Billing customer not found" }, { status: 404 });
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: `${req.nextUrl.origin}/generate`,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Portal session failed" },
      { status: 500 },
    );
  }
}
