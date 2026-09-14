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

export function buildCheckoutSessionParams({
  orderId,
  plan,
  customerEmail,
  siteUrl,
}: BuildCheckoutSessionInput): Stripe.Checkout.SessionCreateParams {
  if (!plan.stripePriceId?.trim()) {
    throw new CheckoutConfigurationError();
  }

  const appUrl = siteUrl.replace(/\/$/, "");

  return {
    mode: plan.billingType === "subscription" ? "subscription" : "payment",
    customer_email: customerEmail ?? undefined,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    metadata: { orderId },
    success_url: `${appUrl}/checkout/success?order_id=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/checkout/cancel?order_id=${orderId}`,
  };
}
