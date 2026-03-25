export type BillingPlanId = "starter" | "pro";

export interface BillingPlanConfig {
  id: BillingPlanId;
  stripePriceId: string;
  monthlyCredits: number;
}

const plans: Record<BillingPlanId, BillingPlanConfig> = {
  starter: {
    id: "starter",
    stripePriceId: process.env.STRIPE_PRICE_STARTER || "",
    monthlyCredits: 50,
  },
  pro: {
    id: "pro",
    stripePriceId: process.env.STRIPE_PRICE_PRO || "",
    monthlyCredits: 200,
  },
};

export function getPlanConfig(planId: BillingPlanId): BillingPlanConfig {
  const config = plans[planId];
  if (!config || !config.stripePriceId) {
    throw new Error(`Missing Stripe price configuration for plan: ${planId}`);
  }
  return config;
}
