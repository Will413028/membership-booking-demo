"use server";

import type Stripe from "stripe";

import { requireUser } from "@/lib/auth/guards";
import {
  assertCheckoutPlanConfigured,
  buildCheckoutSessionParams,
  CheckoutConfigurationError,
} from "@/lib/stripe/checkout";
import { getStripeClient } from "@/lib/stripe/server";
import { createServerClient } from "@/lib/supabase/server";

import type { CheckoutActionResult } from "./types";

type DatabasePlan = {
  id: string;
  billing_type: "subscription" | "one_time";
  stripe_price_id: string | null;
  amount_twd_cents: number;
  class_credits: number | null;
};

type CreatedCheckoutOrder = {
  order_id: string;
  plan_id: string;
  stripe_price_id: string;
  billing_type: "subscription" | "one_time";
  amount_twd_cents: number;
  class_credits: number | null;
};

function isDatabasePlan(value: unknown): value is DatabasePlan {
  if (!value || typeof value !== "object") {
    return false;
  }

  const plan = value as Partial<DatabasePlan>;
  return (
    typeof plan.id === "string" &&
    (plan.billing_type === "subscription" ||
      plan.billing_type === "one_time") &&
    (typeof plan.stripe_price_id === "string" ||
      plan.stripe_price_id === null) &&
    typeof plan.amount_twd_cents === "number" &&
    (typeof plan.class_credits === "number" || plan.class_credits === null)
  );
}

function configurationError(): CheckoutActionResult {
  return {
    ok: false,
    code: "CONFIGURATION_ERROR",
    message: "Checkout is temporarily unavailable.",
  };
}

function retainedOrderError(): CheckoutActionResult {
  return {
    ok: false,
    code: "CONFIGURATION_ERROR",
    message:
      "Checkout setup is pending. Please review your orders before retrying.",
    recovery: "ORDER_RETAINED",
  };
}

function isCreatedCheckoutOrder(value: unknown): value is CreatedCheckoutOrder {
  if (!value || typeof value !== "object") {
    return false;
  }

  const order = value as Partial<CreatedCheckoutOrder>;
  return (
    typeof order.order_id === "string" &&
    typeof order.plan_id === "string" &&
    (order.billing_type === "subscription" ||
      order.billing_type === "one_time") &&
    typeof order.stripe_price_id === "string" &&
    order.stripe_price_id.trim() !== "" &&
    typeof order.amount_twd_cents === "number" &&
    (typeof order.class_credits === "number" || order.class_credits === null)
  );
}

async function linkCheckoutSession(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  orderId: string,
  checkoutSessionId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("link_checkout_session", {
      p_order_id: orderId,
      p_stripe_checkout_session_id: checkoutSessionId,
    });

    return !error && data === true;
  } catch {
    return false;
  }
}

async function discardUnlinkedOrder(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  orderId: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { data, error } = await supabase.rpc("discard_checkout_order", {
        p_order_id: orderId,
      });
      if (!error && data === true) {
        return true;
      }
    } catch {
      // A failed discard retains the order for later reconciliation.
    }
  }

  return false;
}

async function expireStripeSession(
  stripe: Stripe,
  checkoutSessionId: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await stripe.checkout.sessions.expire(checkoutSessionId);
      return true;
    } catch {
      // Keep the pending order when the hosted Session cannot be safely expired.
    }
  }

  return false;
}

function isUncertainStripeCreateError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const stripeError = error as { type?: unknown; code?: unknown };
  return (
    stripeError.type === "StripeConnectionError" ||
    stripeError.code === "ETIMEDOUT" ||
    stripeError.code === "ECONNRESET"
  );
}

function isKnownStripeCreateFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const stripeError = error as { type?: unknown };
  return (
    stripeError.type === "StripeInvalidRequestError" ||
    stripeError.type === "StripeAuthenticationError" ||
    stripeError.type === "StripePermissionError"
  );
}

type CheckoutSessionCreation =
  | { status: "created"; session: Stripe.Checkout.Session }
  | { status: "not_created" }
  | { status: "uncertain" };

async function createCheckoutSession(
  stripe: Stripe,
  params: Stripe.Checkout.SessionCreateParams,
  orderId: string,
): Promise<CheckoutSessionCreation> {
  const requestOptions = { idempotencyKey: `checkout-order:${orderId}` };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return {
        status: "created",
        session: await stripe.checkout.sessions.create(params, requestOptions),
      };
    } catch (error) {
      if (attempt === 0 && isUncertainStripeCreateError(error)) {
        continue;
      }

      return {
        status: isKnownStripeCreateFailure(error) ? "not_created" : "uncertain",
      };
    }
  }

  return { status: "uncertain" };
}

async function cleanUpKnownSession(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  stripe: Stripe,
  orderId: string,
  checkoutSessionId: string,
): Promise<boolean> {
  if (!(await expireStripeSession(stripe, checkoutSessionId))) {
    return false;
  }

  return discardUnlinkedOrder(supabase, orderId);
}

export async function startCheckout(input: {
  planId: string;
}): Promise<CheckoutActionResult> {
  const supabase = await createServerClient();
  const user = await requireUser(supabase);
  const { data: rawPlan, error: planError } = await supabase
    .from("plans")
    .select(
      "id, billing_type, stripe_price_id, amount_twd_cents, class_credits",
    )
    .eq("id", input.planId)
    .eq("active", true)
    .maybeSingle();

  if (planError || !isDatabasePlan(rawPlan)) {
    return {
      ok: false,
      code: "INVALID_PLAN",
      message: "The selected plan is unavailable.",
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    return configurationError();
  }

  const plan = {
    id: rawPlan.id,
    stripePriceId: rawPlan.stripe_price_id,
    billingType: rawPlan.billing_type,
  } as const;
  let stripe: Stripe;
  try {
    assertCheckoutPlanConfigured(plan);
    stripe = getStripeClient();
  } catch (error) {
    if (error instanceof CheckoutConfigurationError) {
      return configurationError();
    }

    return configurationError();
  }

  let createdOrders: unknown;
  try {
    const { data, error } = await supabase.rpc("create_checkout_order", {
      p_plan_id: rawPlan.id,
    });
    if (error) {
      return retainedOrderError();
    }
    createdOrders = data;
  } catch {
    return retainedOrderError();
  }

  const createdOrder = Array.isArray(createdOrders)
    ? createdOrders[0]
    : createdOrders;
  if (!isCreatedCheckoutOrder(createdOrder)) {
    return retainedOrderError();
  }

  let params: Stripe.Checkout.SessionCreateParams;
  try {
    params = buildCheckoutSessionParams({
      orderId: createdOrder.order_id,
      plan: {
        id: createdOrder.plan_id,
        stripePriceId: createdOrder.stripe_price_id,
        billingType: createdOrder.billing_type,
      },
      customerEmail: user.email,
      siteUrl,
    });
  } catch {
    return (await discardUnlinkedOrder(supabase, createdOrder.order_id))
      ? configurationError()
      : retainedOrderError();
  }

  const sessionCreation = await createCheckoutSession(
    stripe,
    params,
    createdOrder.order_id,
  );
  if (sessionCreation.status === "uncertain") {
    return retainedOrderError();
  }
  if (sessionCreation.status === "not_created") {
    return (await discardUnlinkedOrder(supabase, createdOrder.order_id))
      ? configurationError()
      : retainedOrderError();
  }

  const checkoutSession = sessionCreation.session;
  if (!checkoutSession.url) {
    return (await cleanUpKnownSession(
      supabase,
      stripe,
      createdOrder.order_id,
      checkoutSession.id,
    ))
      ? configurationError()
      : retainedOrderError();
  }

  const linked =
    (await linkCheckoutSession(
      supabase,
      createdOrder.order_id,
      checkoutSession.id,
    )) ||
    (await linkCheckoutSession(
      supabase,
      createdOrder.order_id,
      checkoutSession.id,
    ));
  if (!linked) {
    return (await cleanUpKnownSession(
      supabase,
      stripe,
      createdOrder.order_id,
      checkoutSession.id,
    ))
      ? configurationError()
      : retainedOrderError();
  }

  return {
    ok: true,
    orderId: createdOrder.order_id,
    checkoutUrl: checkoutSession.url,
  };
}
