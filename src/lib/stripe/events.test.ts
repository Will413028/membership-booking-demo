import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, rpc, subscriptionRetrieve } = vi.hoisted(() => ({
  rpc: vi.fn(),
  subscriptionRetrieve: vi.fn(),
  from: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../supabase/admin", () => ({
  createAdminClient: () => ({ from, rpc }),
}));

vi.mock("./server", () => ({
  getStripeClient: () => ({
    subscriptions: { retrieve: subscriptionRetrieve },
  }),
}));

import { processStripeEvent } from "./events";

const periodStart = "2026-09-14T23:06:40.000Z";
const periodEnd = "2026-10-14T23:06:40.000Z";

function stripeEvent(type: string, object: Record<string, unknown>) {
  return {
    id: `evt_${type}`,
    type,
    created: 1_789_427_200,
    data: { object },
  } as unknown as Stripe.Event;
}

function subscription(id = "sub_1") {
  return {
    id,
    customer: "cus_1",
    items: {
      data: [
        {
          current_period_start: 1_789_427_200,
          current_period_end: 1_792_019_200,
        },
      ],
    },
  };
}

function configurePaymentLookup() {
  from.mockImplementation((table: string) => {
    if (table === "payments") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { order_id: "order-1" },
              error: null,
            }),
          }),
        }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });
}

describe("processStripeEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: true, error: null });
    subscriptionRetrieve.mockResolvedValue(subscription());
    configurePaymentLookup();
  });

  it("normalizes checkout completion and invokes the transactional RPC", async () => {
    await processStripeEvent(
      stripeEvent("checkout.session.completed", {
        metadata: { orderId: "order-1" },
        customer: "cus_1",
        subscription: "sub_1",
        payment_intent: null,
      }),
    );

    expect(rpc).toHaveBeenCalledWith("apply_stripe_event", {
      p_provider_event_id: "evt_checkout.session.completed",
      p_event_type: "checkout.session.completed",
      p_order_id: "order-1",
      p_customer_id: "cus_1",
      p_subscription_id: "sub_1",
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_payment_reference: null,
    });
  });

  it("normalizes subscription renewal, failure, update, and deletion", async () => {
    const events = [
      stripeEvent("invoice.paid", {
        customer: "cus_1",
        parent: { subscription_details: { subscription: "sub_1" } },
        payment_intent: "pi_paid",
      }),
      stripeEvent("invoice.payment_failed", {
        customer: "cus_1",
        parent: { subscription_details: { subscription: "sub_1" } },
        payment_intent: "pi_failed",
      }),
      stripeEvent("customer.subscription.updated", subscription()),
      stripeEvent("customer.subscription.deleted", subscription()),
    ];

    for (const event of events) {
      await processStripeEvent(event);
    }

    expect(rpc).toHaveBeenNthCalledWith(1, "apply_stripe_event", {
      p_provider_event_id: "evt_invoice.paid",
      p_event_type: "invoice.paid",
      p_order_id: "order-1",
      p_customer_id: "cus_1",
      p_subscription_id: "sub_1",
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_payment_reference: "pi_paid",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "apply_stripe_event", {
      p_provider_event_id: "evt_invoice.payment_failed",
      p_event_type: "invoice.payment_failed",
      p_order_id: "order-1",
      p_customer_id: "cus_1",
      p_subscription_id: "sub_1",
      p_period_start: null,
      p_period_end: null,
      p_payment_reference: "pi_failed",
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "apply_stripe_event", {
      p_provider_event_id: "evt_customer.subscription.updated",
      p_event_type: "customer.subscription.updated",
      p_order_id: "order-1",
      p_customer_id: "cus_1",
      p_subscription_id: "sub_1",
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_payment_reference: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(4, "apply_stripe_event", {
      p_provider_event_id: "evt_customer.subscription.deleted",
      p_event_type: "customer.subscription.deleted",
      p_order_id: "order-1",
      p_customer_id: "cus_1",
      p_subscription_id: "sub_1",
      p_period_start: null,
      p_period_end: null,
      p_payment_reference: null,
    });
  });

  it("lets the database treat a duplicate provider event as a no-op", async () => {
    rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });
    const event = stripeEvent("checkout.session.completed", {
      metadata: { orderId: "order-1" },
      customer: "cus_1",
      subscription: "sub_1",
      payment_intent: null,
    });

    await processStripeEvent(event);
    await processStripeEvent(event);

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0]?.[1]).toEqual(rpc.mock.calls[1]?.[1]);
  });
});
