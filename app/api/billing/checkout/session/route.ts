import { NextRequest, NextResponse } from "next/server";
import { requireRequestContext } from "@/lib/request-context";
import { getPlanConfig, type BillingPlanId } from "@/lib/billing-config";
import { getStripe } from "@/lib/stripe";
import { getOrCreateStripeCustomer } from "@/lib/billing";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const context = await requireRequestContext(req);
    const rate = checkRateLimit(
      `billing_checkout:${context.tenantId ?? "user"}:${context.tenantId ?? context.userId}`,
    );
    if (!rate.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const { planId } = (await req.json()) as { planId?: BillingPlanId };
    if (!planId || (planId !== "starter" && planId !== "pro")) {
      return NextResponse.json({ error: "Invalid planId" }, { status: 400 });
    }

    const plan = getPlanConfig(planId);
    const stripe = getStripe();

    const customerId = await getOrCreateStripeCustomer({
      userId: context.userId,
      tenantId: context.tenantId,
      email: context.email,
    });

    const origin = req.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${origin}/generate?billing=success`,
      cancel_url: `${origin}/generate?billing=cancelled`,
      metadata: {
        plan_id: plan.id,
        user_id: context.userId,
        tenant_id: context.tenantId ?? "",
      },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 500 },
    );
  }
}
