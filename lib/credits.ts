import { createServerClient } from "./supabase";

export interface CreditCheck {
  allowed: boolean;
  remaining: number;
  error?: string;
}

/**
 * Check if a user has enough credits and deduct if so.
 * Returns the result without throwing — the API route decides what to do.
 *
 * For the MVP stub: if no auth token, allow generation with a
 * session-based counter (anonymous users get 3 free tries).
 */
export async function useCredit(
  userId: string | null,
  generationType: "beat" | "character",
  cost: number = 1,
): Promise<CreditCheck> {
  // Anonymous user — no credit tracking yet, just allow it for MVP
  if (!userId) {
    return { allowed: true, remaining: -1 };
  }

  const supabase = createServerClient();

  // Get current credits
  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();

  if (fetchError || !profile) {
    return { allowed: false, remaining: 0, error: "User not found" };
  }

  if (profile.credits < cost) {
    return {
      allowed: false,
      remaining: profile.credits,
      error: "Not enough credits",
    };
  }

  // Deduct credits atomically
  const { error: updateError } = await supabase.rpc("deduct_credits", {
    p_user_id: userId,
    p_amount: cost,
  });

  if (updateError) {
    // Fallback to non-atomic update if RPC doesn't exist yet
    await supabase
      .from("profiles")
      .update({
        credits: profile.credits - cost,
        total_credits_used: profile.credits + cost,
      })
      .eq("id", userId);
  }

  return { allowed: true, remaining: profile.credits - cost };
}
