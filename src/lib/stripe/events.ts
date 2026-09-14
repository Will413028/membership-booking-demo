import type Stripe from "stripe";

import { createAdminClient } from "../supabase/admin";

type MembershipStatus = "active" | "past_due" | "canceled" | "expired";
type Period = { start: string; end: string };

function providerId(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string"
  )
    return value.id;
  return null;
}

function isoDate(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0)
    throw new Error("Invalid Stripe timestamp.");
  return new Date(timestamp * 1000).toISOString();
}

function invoicePeriod(
  invoice: Stripe.Invoice,
  subscriptionId: string,
): Period {
  // The app sells one recurring Price, with no proration or mixed intervals.
  // Do not retrieve the current subscription: it may already be several periods ahead.
  const lines = invoice.lines.data.filter(
    (line) =>
      line.parent?.type === "subscription_item_details" &&
      providerId(line.parent.subscription_item_details?.subscription) ===
        subscriptionId &&
      !line.parent.subscription_item_details?.proration,
  );
  if (
    invoice.lines.has_more ||
    lines.length !== 1 ||
    lines[0].period.end <= lines[0].period.start
  ) {
    throw new Error("Unsupported Stripe invoice period.");
  }
  return {
    start: isoDate(lines[0].period.start),
    end: isoDate(lines[0].period.end),
  };
}

export function membershipStatus(
  status: Stripe.Subscription.Status,
): MembershipStatus {
  switch (status) {
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "paused":
      return "past_due";
    case "canceled":
      return "canceled";
    case "incomplete_expired":
    case "trialing":
      return "expired"; // Trial grants are outside this paid-only demo.
    default:
      throw new Error("Unsupported Stripe subscription status.");
  }
}

async function orderIdForSubscription(
  subscriptionId: string,
  metadataOrderId?: string,
): Promise<string> {
  if (metadataOrderId) return metadataOrderId;
  const { data, error } = await createAdminClient()
    .from("payments")
    .select("order_id")
    .eq("provider_subscription_id", subscriptionId)
    .maybeSingle();
  if (error || !data?.order_id)
    throw new Error("Stripe subscription is not linked to an order.");
  return data.order_id;
}

export async function processStripeEvent(event: Stripe.Event): Promise<void> {
  if (event.livemode !== false)
    throw new Error("Only Stripe test-mode events are accepted.");
  const type = event.type;
  if (
    ![
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "invoice.paid",
      "invoice.payment_failed",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ].includes(type)
  )
    return;
  const created = isoDate(event.created);
  let orderId: string;
  let subscriptionId: string | null;
  let customerId: string | null;
  let period: Period | null = null;
  let paymentReference: string | null = null;
  let paymentStatus: string | null = null;
  let status: MembershipStatus | null = null;

  if (
    type === "checkout.session.completed" ||
    type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.livemode !== false)
      throw new Error("Only test-mode Checkout is accepted.");
    // Deferred methods are fulfilled by async_payment_succeeded (or invoice.paid).
    if (session.payment_status !== "paid") return;
    if (!session.metadata?.orderId)
      throw new Error("Checkout is missing its order.");
    orderId = session.metadata.orderId;
    subscriptionId = providerId(session.subscription);
    customerId = providerId(session.customer);
    paymentStatus = session.payment_status;
    paymentReference = providerId(session.payment_intent);
    if (!subscriptionId) {
      period = {
        start: created,
        end: new Date(event.created * 1000 + 30 * 86400000).toISOString(),
      };
    }
  } else if (type === "invoice.paid" || type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    if (invoice.livemode !== false)
      throw new Error("Only test-mode invoices are accepted.");
    subscriptionId = providerId(
      invoice.parent?.subscription_details?.subscription,
    );
    if (!subscriptionId) return; // Unrelated standalone invoices are outside this app.
    if (type === "invoice.paid" && invoice.status !== "paid") return;
    // Mid-period upgrades/proration cannot grant or reset credits.
    if (
      !["subscription_create", "subscription_cycle"].includes(
        invoice.billing_reason ?? "",
      )
    )
      return;
    period = invoicePeriod(invoice, subscriptionId);
    orderId = await orderIdForSubscription(
      subscriptionId,
      invoice.parent?.subscription_details?.metadata?.orderId,
    );
    customerId = providerId(invoice.customer);
    paymentStatus = type === "invoice.paid" ? "paid" : "unpaid";
    paymentReference = providerId(
      invoice.payments?.data[0]?.payment.payment_intent,
    );
  } else {
    const subscription = event.data.object as Stripe.Subscription;
    if (subscription.livemode !== false)
      throw new Error("Only test-mode subscriptions are accepted.");
    subscriptionId = subscription.id;
    orderId = await orderIdForSubscription(
      subscriptionId,
      subscription.metadata?.orderId,
    );
    customerId = providerId(subscription.customer);
    status =
      type === "customer.subscription.deleted"
        ? "canceled"
        : membershipStatus(subscription.status);
    // Subscription status events never advance the paid credit period.
  }
  const { error } = await createAdminClient().rpc("apply_stripe_event_v2", {
    p_provider_event_id: event.id,
    p_event_type: type,
    p_order_id: orderId,
    p_customer_id: customerId,
    p_subscription_id: subscriptionId,
    p_period_start: period?.start ?? null,
    p_period_end: period?.end ?? null,
    p_payment_reference: paymentReference,
    p_event_created_at: created,
    p_membership_status: status,
    p_payment_status: paymentStatus,
  });
  if (error) throw new Error("Unable to apply Stripe event transition.");
}
