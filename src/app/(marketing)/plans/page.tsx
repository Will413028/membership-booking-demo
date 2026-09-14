import { SectionHeading } from "@/components/shared/section-heading";
import { PlanGrid } from "@/features/plans/components/plan-grid";
import { getCurrentUser } from "@/lib/auth/guards";
import type { Plan } from "@/lib/domain/types";
import { createServerClient } from "@/lib/supabase/server";

export default async function PlansPage() {
  const supabase = await createServerClient();
  const [plansResult, user] = await Promise.all([
    supabase
      .from("plans")
      .select(
        "id, code, billing_type, stripe_price_id, class_credits, amount_twd_cents",
      )
      .eq("active", true)
      .order("amount_twd_cents"),
    getCurrentUser(supabase),
  ]);
  const plans = (plansResult.data ?? []).map((plan) => ({
    id: plan.id,
    code: plan.code,
    billingType: plan.billing_type,
    stripePriceId: plan.stripe_price_id,
    classCredits: plan.class_credits,
    amountTwdCents: plan.amount_twd_cents,
  })) as Plan[];
  return (
    <section className="page-shell py-12 md:py-20">
      <SectionHeading
        eyebrow="Membership"
        title="把練習留在生活裡"
        description="從每月八堂、無限練習到單堂體驗，選擇目前最適合你的節奏。"
      />
      <div className="mt-10">
        {plans.length ? (
          <PlanGrid plans={plans} isAuthenticated={Boolean(user)} />
        ) : (
          <p className="rounded-3xl bg-sage p-8 text-muted-foreground">
            方案資訊暫時無法載入，請稍後再試。
          </p>
        )}
      </div>
    </section>
  );
}
