"use server";

import { requireUser } from "@/lib/auth/guards";
import {
  buildCheckoutSessionParams,
  CheckoutConfigurationError,
} from "@/lib/stripe/checkout";
import { getStripeClient } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

import type { CheckoutActionResult } from "./types";

type DatabasePlan = {
  id: string;
  billing_type: "subscription" | "one_time";
  stripe_price_id: string | null;
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

export async function startCheckout(input: {
  planId: string;
}): Promise<CheckoutActionResult> {
  try {
    const user = await requireUser();
    const admin = createAdminClient();
    const { data: rawPlan, error: planError } = await admin
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

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        user_id: user.id,
        status: "pending",
        amount_twd_cents: rawPlan.amount_twd_cents,
        currency: "twd",
      })
      .select("id")
      .single();

    if (orderError || !order?.id) {
      return configurationError();
    }

    const { error: itemError } = await admin.from("order_items").insert({
      order_id: order.id,
      plan_id: rawPlan.id,
      quantity: 1,
      unit_amount_twd_cents: rawPlan.amount_twd_cents,
    });
    if (itemError) {
      return configurationError();
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      return configurationError();
    }

    const params = buildCheckoutSessionParams({
      orderId: order.id,
      plan: {
        id: rawPlan.id,
        stripePriceId: rawPlan.stripe_price_id,
        billingType: rawPlan.billing_type,
      },
      customerEmail: user.email,
      siteUrl,
    });
    const checkoutSession =
      await getStripeClient().checkout.sessions.create(params);
    if (!checkoutSession.url) {
      return configurationError();
    }

    const { error: sessionUpdateError } = await admin
      .from("orders")
      .update({ stripe_checkout_session_id: checkoutSession.id })
      .eq("id", order.id);
    if (sessionUpdateError) {
      return configurationError();
    }

    return {
      ok: true,
      orderId: order.id,
      checkoutUrl: checkoutSession.url,
    };
  } catch (error) {
    if (error instanceof CheckoutConfigurationError) {
      return configurationError();
    }

    return configurationError();
  }
}
