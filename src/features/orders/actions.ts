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

type CreatedCheckoutOrder = DatabasePlan & {
  order_id: string;
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

function isCreatedCheckoutOrder(value: unknown): value is CreatedCheckoutOrder {
  const orderId = (value as { order_id?: unknown }).order_id;
  return isDatabasePlan(value) && typeof orderId === "string";
}

async function linkCheckoutSession(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  orderId: string,
  checkoutSessionId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("link_checkout_session", {
    p_order_id: orderId,
    p_stripe_checkout_session_id: checkoutSessionId,
  });

  return !error && data === true;
}

async function discardUnlinkedOrder(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  orderId: string,
): Promise<void> {
  await supabase.rpc("discard_checkout_order", { p_order_id: orderId });
}

async function expireStripeSession(
  checkoutSessionId: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await getStripeClient().checkout.sessions.expire(checkoutSessionId);
      return true;
    } catch {
      // Keep the pending order when the hosted Session cannot be safely expired.
    }
  }

  return false;
}

export async function startCheckout(input: {
  planId: string;
}): Promise<CheckoutActionResult> {
  try {
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
    assertCheckoutPlanConfigured(plan);
    const stripe = getStripeClient();

    const { data: createdOrders, error: createOrderError } = await supabase.rpc(
      "create_checkout_order",
      { p_plan_id: rawPlan.id },
    );
    const createdOrder = Array.isArray(createdOrders)
      ? createdOrders[0]
      : createdOrders;
    if (createOrderError || !isCreatedCheckoutOrder(createdOrder)) {
      return configurationError();
    }

    const params = buildCheckoutSessionParams({
      orderId: createdOrder.order_id,
      plan: {
        id: createdOrder.id,
        stripePriceId: createdOrder.stripe_price_id,
        billingType: createdOrder.billing_type,
      },
      customerEmail: user.email,
      siteUrl,
    });
    let checkoutSession: Stripe.Checkout.Session;
    try {
      checkoutSession = await stripe.checkout.sessions.create(params);
    } catch {
      await discardUnlinkedOrder(supabase, createdOrder.order_id);
      return configurationError();
    }

    if (!checkoutSession.url) {
      if (
        checkoutSession.id &&
        (await expireStripeSession(checkoutSession.id))
      ) {
        await discardUnlinkedOrder(supabase, createdOrder.order_id);
      }
      return configurationError();
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
      if (await expireStripeSession(checkoutSession.id)) {
        await discardUnlinkedOrder(supabase, createdOrder.order_id);
      }
      return configurationError();
    }

    return {
      ok: true,
      orderId: createdOrder.order_id,
      checkoutUrl: checkoutSession.url,
    };
  } catch (error) {
    if (error instanceof CheckoutConfigurationError) {
      return configurationError();
    }

    return configurationError();
  }
}
