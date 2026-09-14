import { DataError } from "@/lib/errors/data";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { createServerClient } from "@/lib/supabase/server";

export type ActiveMembership = {
  id: string;
  status: "active";
  creditsRemaining: number | null;
  currentPeriodEnd: string;
};

type DatabaseMembership = {
  id: string;
  status: "active";
  credits_remaining: number | null;
  current_period_end: string;
};

function isActiveMembership(value: unknown): value is DatabaseMembership {
  if (!value || typeof value !== "object") {
    return false;
  }

  const membership = value as Partial<DatabaseMembership>;
  return (
    typeof membership.id === "string" &&
    membership.status === "active" &&
    (typeof membership.credits_remaining === "number" ||
      membership.credits_remaining === null) &&
    typeof membership.current_period_end === "string"
  );
}

export async function getActiveMembership(
  userId: string,
  client?: ServerSupabaseClient,
  includeExhausted = false,
): Promise<ActiveMembership | null> {
  const supabase = client ?? (await createServerClient());
  const now = new Date().toISOString();
  let query = supabase
    .from("memberships")
    .select("id, status, credits_remaining, current_period_end")
    .eq("user_id", userId)
    .eq("status", "active")
    .lte("current_period_start", now)
    .gt("current_period_end", now);
  if (!includeExhausted)
    query = query.or("credits_remaining.is.null,credits_remaining.gt.0");
  const { data, error } = await query
    .order("current_period_end", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new DataError();
  if (!data) return null;
  if (!isActiveMembership(data)) throw new DataError();

  return {
    id: data.id,
    status: data.status,
    creditsRemaining: data.credits_remaining,
    currentPeriodEnd: data.current_period_end,
  };
}
