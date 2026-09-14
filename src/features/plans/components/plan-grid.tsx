import { startCheckout } from "@/features/orders/actions";
import type { Plan } from "@/lib/domain/types";

import { PlanCard } from "./plan-card";

export function PlanGrid({
  plans,
  isAuthenticated,
}: {
  plans: Plan[];
  isAuthenticated: boolean;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          isAuthenticated={isAuthenticated}
          startCheckoutAction={startCheckout}
        />
      ))}
    </div>
  );
}
