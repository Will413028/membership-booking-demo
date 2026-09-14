import { ConfigurationError } from "@/components/shared/configuration-error";
import { SectionHeading } from "@/components/shared/section-heading";
import { PlanGrid } from "@/features/plans/components/plan-grid";
import { getCurrentUser } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/types";
import type { Plan } from "@/lib/domain/types";
import { isConfigurationError } from "@/lib/errors/configuration";
import { createServerClient } from "@/lib/supabase/server";

export default async function PlansPage() {
  let plans: Plan[];
  let user: SessionUser | null;
  try {
    const supabase = await createServerClient();
    const [plansResult, currentUser] = await Promise.all([
      supabase
        .from("plans")
        .select(
          "id, code, billing_type, stripe_price_id, class_credits, amount_twd_cents",
        )
        .eq("active", true)
        .order("amount_twd_cents"),
      getCurrentUser(supabase),
    ]);
    if (plansResult.error) return <PlansUnavailable />;
    plans = (plansResult.data ?? []).map((plan) => ({
      id: plan.id,
      code: plan.code,
      billingType: plan.billing_type,
      stripePriceId: plan.stripe_price_id,
      classCredits: plan.class_credits,
      amountTwdCents: plan.amount_twd_cents,
    })) as Plan[];
    user = currentUser;
  } catch (error) {
    if (isConfigurationError(error)) return <ConfigurationError />;
    return <PlansUnavailable />;
  }
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
          <PlansUnavailable />
        )}
      </div>
    </section>
  );
}

function PlansUnavailable() {
  return (
    <p className="rounded-3xl bg-sage p-8 text-muted-foreground">
      方案資訊暫時無法載入，請稍後再試。
    </p>
  );
}
