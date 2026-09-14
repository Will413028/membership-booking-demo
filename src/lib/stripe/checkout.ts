import type Stripe from "stripe";

export class CheckoutConfigurationError extends Error {
  constructor() {
    super("Stripe Checkout is not configured.");
    this.name = "CheckoutConfigurationError";
  }
}

export type CheckoutPlan = {
  id: string;
  stripePriceId: string | null;
  billingType: "subscription" | "one_time";
};

export type BuildCheckoutSessionInput = {
  orderId: string;
  plan: CheckoutPlan;
  customerEmail: string | null;
  siteUrl: string;
};

export function assertCheckoutPlanConfigured(plan: CheckoutPlan): void {
  configuredStripePriceId(plan);
}

function configuredStripePriceId(plan: CheckoutPlan): string {
  if (!plan.stripePriceId?.trim()) {
    throw new CheckoutConfigurationError();
  }

  return plan.stripePriceId;
}

export function buildCheckoutSessionParams({
  orderId,
  plan,
  customerEmail,
  siteUrl,
}: BuildCheckoutSessionInput): Stripe.Checkout.SessionCreateParams {
  const stripePriceId = configuredStripePriceId(plan);

  const appUrl = siteUrl.replace(/\/$/, "");

  return {
    mode: plan.billingType === "subscription" ? "subscription" : "payment",
    customer_email: customerEmail ?? undefined,
    line_items: [{ price: stripePriceId, quantity: 1 }],
    metadata: { orderId },
    success_url: `${appUrl}/checkout/success?order_id=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/checkout/cancel?order_id=${orderId}`,
  };
}
