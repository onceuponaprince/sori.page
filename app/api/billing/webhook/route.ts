import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantCredits } from "@/lib/credits";
import { getPlanConfig, type BillingPlanId } from "@/lib/billing-config";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing webhook configuration" }, { status: 400 });
  }

  const payload = await req.text();
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid signature" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { error: dedupeError } = await supabase.from("billing_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event as unknown as Record<string, unknown>,
  });
  if (dedupeError && dedupeError.code !== "23505") {
    return NextResponse.json({ error: dedupeError.message }, { status: 500 });
  }
  if (dedupeError && dedupeError.code === "23505") {
    return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = String(session.customer || "");
      const metadata = session.metadata || {};
      const planId = (metadata.plan_id as BillingPlanId) || "starter";
      const plan = getPlanConfig(planId);

      const { data: billingCustomer } = await supabase
        .from("billing_customers")
        .select("user_id, tenant_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();

      if (billingCustomer) {
        await grantCredits({
          userId: billingCustomer.user_id,
          tenantId: billingCustomer.tenant_id,
          amount: plan.monthlyCredits,
          reason: "stripe_checkout_completed",
          operationKey: `stripe:${event.id}:grant`,
          stripeEventId: event.id,
        });
      }
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const subscriptionAny = subscription as unknown as {
        current_period_start?: number;
        current_period_end?: number;
      };
      const customerId = String(subscription.customer || "");
      const { data: billingCustomer } = await supabase
        .from("billing_customers")
        .select("user_id, tenant_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();

      if (billingCustomer) {
        await supabase.from("subscriptions").upsert(
          {
            user_id: billingCustomer.user_id,
            tenant_id: billingCustomer.tenant_id,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: customerId,
            stripe_price_id:
              subscription.items.data[0]?.price?.id || null,
            status: subscription.status,
            current_period_start: subscriptionAny.current_period_start
              ? new Date(subscriptionAny.current_period_start * 1000).toISOString()
              : null,
            current_period_end: subscriptionAny.current_period_end
              ? new Date(subscriptionAny.current_period_end * 1000).toISOString()
              : null,
            cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "stripe_subscription_id" },
        );
      }
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = String(invoice.customer || "");
      const { data: billingCustomer } = await supabase
        .from("billing_customers")
        .select("user_id, tenant_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();

      const firstLineAny = invoice.lines.data[0] as unknown as {
        price?: { id?: string };
      };
      const priceId = firstLineAny?.price?.id || "";
      if (billingCustomer && typeof priceId === "string") {
        const plan = priceId === process.env.STRIPE_PRICE_PRO
          ? getPlanConfig("pro")
          : getPlanConfig("starter");
        await grantCredits({
          userId: billingCustomer.user_id,
          tenantId: billingCustomer.tenant_id,
          amount: plan.monthlyCredits,
          reason: "stripe_invoice_paid",
          operationKey: `stripe:${event.id}:grant`,
          stripeEventId: event.id,
        });
      }
    }

    logAudit("stripe_webhook_processed", {
      event_id: event.id,
      event_type: event.type,
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook handler failed" },
      { status: 500 },
    );
  }
}
