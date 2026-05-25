"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import type { BillingPlanId } from "@/lib/billing-config";

interface BillingSectionProps {
  credits: number;
  tier: string;
  hasBillingCustomer: boolean;
}

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = createBrowserClient();
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  const tenantId =
    (session?.user?.user_metadata?.tenant_id as string | undefined) ||
    (session?.user?.app_metadata?.tenant_id as string | undefined);
  if (tenantId) headers["X-Tenant-Id"] = tenantId;
  return headers;
}

const PLANS: Array<{
  id: BillingPlanId;
  name: string;
  credits: number;
  description: string;
}> = [
  {
    id: "starter",
    name: "Starter",
    credits: 50,
    description: "For writers testing character chat and beat tools.",
  },
  {
    id: "pro",
    name: "Pro",
    credits: 200,
    description: "For active drafting with room for Talk and analysis.",
  },
];

export function BillingSection({
  credits,
  tier,
  hasBillingCustomer,
}: BillingSectionProps) {
  const [loading, setLoading] = useState<BillingPlanId | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(planId: BillingPlanId) {
    setLoading(planId);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout/session", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ planId }),
      });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Checkout failed");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setLoading(null);
    }
  }

  async function openPortal() {
    setLoading("portal");
    setError(null);
    try {
      const res = await fetch("/api/billing/portal/session", {
        method: "POST",
        headers: await authHeaders(),
      });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Billing portal unavailable");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Billing portal failed");
      setLoading(null);
    }
  }

  return (
    <section className="mt-6 border border-border bg-card p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="sori-kicker">billing</p>
          <h2
            style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem" }}
            className="mt-1 font-medium text-foreground"
          >
            Plan &amp; Credits
          </h2>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Balance</p>
          <p
            style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem" }}
            className="font-medium text-foreground"
          >
            {credits}
          </p>
          <p className="text-xs text-muted-foreground">credits · {tier} tier</p>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {PLANS.map((plan) => (
          <div key={plan.id} className="border border-border p-4">
            <div className="mb-3">
              <h3 className="text-sm font-medium text-foreground">{plan.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
            </div>
            <p className="mb-4 text-sm text-foreground">
              {plan.credits} credits / month
            </p>
            <button
              type="button"
              onClick={() => void startCheckout(plan.id)}
              disabled={loading !== null}
              className="w-full border border-accent bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {loading === plan.id ? "Redirecting…" : `Upgrade to ${plan.name}`}
            </button>
          </div>
        ))}
      </div>

      {hasBillingCustomer && (
        <div className="mt-4 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => void openPortal()}
            disabled={loading !== null}
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
          >
            {loading === "portal" ? "Opening portal…" : "Manage subscription & invoices"}
          </button>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Talk messages and other AI features draw from the same credit pool.{" "}
        <Link href="/account" className="underline-offset-2 hover:underline">
          Refresh this page
        </Link>{" "}
        after checkout to see your updated balance.
      </p>
    </section>
  );
}
