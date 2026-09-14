import "server-only";

import Stripe from "stripe";

export class StripeConfigurationError extends Error {
  constructor() {
    super("Stripe is not configured.");
    this.name = "StripeConfigurationError";
  }
}

let stripeClient: Stripe | undefined;

export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey || !/^(sk|rk)_test_/.test(secretKey)) {
    throw new StripeConfigurationError();
  }

  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
}
