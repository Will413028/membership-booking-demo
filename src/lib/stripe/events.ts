import type Stripe from "stripe";

import { createAdminClient } from "../supabase/admin";
import { getStripeClient } from "./server";

type StripeEventType =
  | "checkout.session.completed"
  | "invoice.paid"
  | "invoice.payment_failed"
  | "customer.subscription.updated"
  | "customer.subscription.deleted";

type ApplyStripeEventArgs = {
  p_provider_event_id: string;
  p_event_type: StripeEventType;
  p_order_id: string;
  p_customer_id: string | null;
  p_subscription_id: string | null;
  p_period_start: string | null;
  p_period_end: string | null;
  p_payment_reference: string | null;
};

type Period = {
  start: string;
  end: string;
};

function providerId(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string"
  ) {
    return value.id;
  }

  return null;
}

function isoDate(timestamp: unknown): string | null {
  if (typeof timestamp !== "number") {
    return null;
  }

  return new Date(timestamp * 1_000).toISOString();
}

function subscriptionPeriod(value: unknown): Period | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const items = (value as { items?: { data?: unknown[] } }).items;
  const item = items?.data?.[0];
  if (!item || typeof item !== "object") {
    return null;
  }

  const periodStart = isoDate(
    (item as { current_period_start?: unknown }).current_period_start,
  );
  const periodEnd = isoDate(
    (item as { current_period_end?: unknown }).current_period_end,
  );

  return periodStart && periodEnd
    ? { start: periodStart, end: periodEnd }
    : null;
}

async function resolveSubscriptionPeriod(
  subscription: unknown,
): Promise<Period | null> {
  const direct = subscriptionPeriod(subscription);
  if (direct) {
    return direct;
  }

  const subscriptionId = providerId(subscription);
  if (!subscriptionId) {
    return null;
  }

  return subscriptionPeriod(
    await getStripeClient().subscriptions.retrieve(subscriptionId),
  );
}

function oneTimePeriod(eventCreatedAt: number): Period {
  const start = new Date(eventCreatedAt * 1_000);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 30);

  return { start: start.toISOString(), end: end.toISOString() };
}

async function orderIdForSubscription(subscriptionId: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payments")
    .select("order_id")
    .eq("provider_subscription_id", subscriptionId)
    .maybeSingle();

  if (error || !data?.order_id) {
    throw new Error("Stripe subscription is not linked to an order.");
  }

  return data.order_id;
}

function invoiceSubscription(invoice: Stripe.Invoice): unknown {
  return invoice.parent?.subscription_details?.subscription ?? null;
}

function paymentReference(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const direct = providerId(
    (value as { payment_intent?: unknown }).payment_intent,
  );
  if (direct) {
    return direct;
  }

  const payment = (value as { payments?: { data?: unknown[] } }).payments
    ?.data?.[0];
  if (!payment || typeof payment !== "object") {
    return null;
  }

  return providerId(
    (payment as { payment?: { payment_intent?: unknown } }).payment
      ?.payment_intent,
  );
}

function isHandledEvent(type: string): type is StripeEventType {
  return (
    type === "checkout.session.completed" ||
    type === "invoice.paid" ||
    type === "invoice.payment_failed" ||
    type === "customer.subscription.updated" ||
    type === "customer.subscription.deleted"
  );
}

async function normalizeStripeEvent(
  event: Stripe.Event,
): Promise<ApplyStripeEventArgs | null> {
  if (!isHandledEvent(event.type)) {
    return null;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (!orderId) {
      throw new Error("Checkout session is missing an internal order ID.");
    }

    const subscriptionId = providerId(session.subscription);
    const period = subscriptionId
      ? await resolveSubscriptionPeriod(session.subscription)
      : oneTimePeriod(event.created);
    if (!period) {
      throw new Error("Stripe subscription is missing its billing period.");
    }

    return {
      p_provider_event_id: event.id,
      p_event_type: event.type,
      p_order_id: orderId,
      p_customer_id: providerId(session.customer),
      p_subscription_id: subscriptionId,
      p_period_start: period.start,
      p_period_end: period.end,
      p_payment_reference: paymentReference(session),
    };
  }

  if (
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_failed"
  ) {
    const invoice = event.data.object as Stripe.Invoice;
    const sourceSubscription = invoiceSubscription(invoice);
    const subscriptionId = providerId(sourceSubscription);
    if (!subscriptionId) {
      throw new Error("Stripe invoice is missing its subscription.");
    }

    const period =
      event.type === "invoice.paid"
        ? await resolveSubscriptionPeriod(sourceSubscription)
        : null;
    if (event.type === "invoice.paid" && !period) {
      throw new Error("Stripe invoice is missing its billing period.");
    }

    return {
      p_provider_event_id: event.id,
      p_event_type: event.type,
      p_order_id: await orderIdForSubscription(subscriptionId),
      p_customer_id: providerId(invoice.customer),
      p_subscription_id: subscriptionId,
      p_period_start: period?.start ?? null,
      p_period_end: period?.end ?? null,
      p_payment_reference: paymentReference(invoice),
    };
  }

  const subscription = event.data.object as Stripe.Subscription;
  const subscriptionId = subscription.id;
  if (!subscriptionId) {
    throw new Error("Stripe subscription is missing its ID.");
  }

  const period =
    event.type === "customer.subscription.updated"
      ? subscriptionPeriod(subscription)
      : null;
  if (event.type === "customer.subscription.updated" && !period) {
    throw new Error("Stripe subscription is missing its billing period.");
  }

  return {
    p_provider_event_id: event.id,
    p_event_type: event.type,
    p_order_id: await orderIdForSubscription(subscriptionId),
    p_customer_id: providerId(subscription.customer),
    p_subscription_id: subscriptionId,
    p_period_start: period?.start ?? null,
    p_period_end: period?.end ?? null,
    p_payment_reference: null,
  };
}

export async function processStripeEvent(event: Stripe.Event): Promise<void> {
  const normalized = await normalizeStripeEvent(event);
  if (!normalized) {
    return;
  }

  const { error } = await createAdminClient().rpc(
    "apply_stripe_event",
    normalized,
  );

  if (error) {
    throw new Error("Unable to apply Stripe event transition.");
  }
}
