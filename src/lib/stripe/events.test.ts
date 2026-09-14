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

import { membershipStatus, processStripeEvent } from "./events";

const start = 1789427200;
const end = start + 30 * 86400;
function event(type: string, object: Record<string, unknown>): Stripe.Event {
  return {
    id: `evt_${type}`,
    type,
    created: start + 600,
    livemode: false,
    data: { object: { livemode: false, ...object } },
  } as unknown as Stripe.Event;
}
function checkout(overrides = {}) {
  return {
    metadata: { orderId: "order-1" },
    customer: "cus_1",
    subscription: "sub_1",
    payment_intent: null,
    payment_status: "paid",
    ...overrides,
  };
}
function invoice(overrides = {}) {
  return {
    customer: "cus_1",
    status: "paid",
    billing_reason: "subscription_cycle",
    parent: {
      subscription_details: {
        subscription: "sub_1",
        metadata: { orderId: "order-1" },
      },
    },
    lines: {
      has_more: false,
      data: [
        {
          period: { start, end },
          parent: {
            type: "subscription_item_details",
            subscription_item_details: {
              subscription: "sub_1",
              proration: false,
            },
          },
        },
      ],
    },
    ...overrides,
  };
}
describe("processStripeEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: true, error: null });
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { order_id: "order-1" },
            error: null,
          }),
        }),
      }),
    });
  });
  it("passes paid evidence and event time, deferring subscription grants to invoice.paid", async () => {
    const input = event("checkout.session.completed", checkout());
    await processStripeEvent(input);
    expect(rpc).toHaveBeenCalledWith("apply_stripe_event_v2", {
      p_provider_event_id: input.id,
      p_event_type: input.type,
      p_order_id: "order-1",
      p_customer_id: "cus_1",
      p_subscription_id: "sub_1",
      p_period_start: null,
      p_period_end: null,
      p_payment_reference: null,
      p_event_created_at: new Date(input.created * 1000).toISOString(),
      p_membership_status: null,
      p_payment_status: "paid",
    });
    expect(subscriptionRetrieve).not.toHaveBeenCalled();
  });
  it.each([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
  ])(
    "grants a one-time paid checkout for exactly 30 days: %s",
    async (type) => {
      const input = event(
        type,
        checkout({ subscription: null, payment_intent: "pi_1" }),
      );
      await processStripeEvent(input);
      expect(rpc).toHaveBeenCalledWith(
        "apply_stripe_event_v2",
        expect.objectContaining({
          p_period_start: new Date(input.created * 1000).toISOString(),
          p_period_end: new Date(
            (input.created + 30 * 86400) * 1000,
          ).toISOString(),
          p_payment_reference: "pi_1",
          p_subscription_id: null,
        }),
      );
    },
  );
  it.each(["unpaid", "no_payment_required"])(
    "never grants unpaid completion: %s",
    async (payment_status) => {
      await processStripeEvent(
        event("checkout.session.completed", checkout({ payment_status })),
      );
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it("uses immutable invoice line periods and metadata even before Checkout", async () => {
    await processStripeEvent(event("invoice.paid", invoice()));
    expect(from).not.toHaveBeenCalled();
    expect(subscriptionRetrieve).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      "apply_stripe_event_v2",
      expect.objectContaining({
        p_period_start: new Date(start * 1000).toISOString(),
        p_period_end: new Date(end * 1000).toISOString(),
        p_payment_status: "paid",
      }),
    );
  });
  it("includes the failed invoice's period so old failures cannot poison a renewal", async () => {
    await processStripeEvent(
      event("invoice.payment_failed", invoice({ status: "open" })),
    );
    expect(rpc).toHaveBeenCalledWith(
      "apply_stripe_event_v2",
      expect.objectContaining({
        p_event_type: "invoice.payment_failed",
        p_payment_status: "unpaid",
        p_period_start: new Date(start * 1000).toISOString(),
      }),
    );
  });
  it.each(["subscription_update", "manual"])(
    "ignores unsupported invoice billing reason: %s",
    async (billing_reason) => {
      await processStripeEvent(
        event("invoice.paid", invoice({ billing_reason })),
      );
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it("does not trust a paid event type without a paid invoice", async () => {
    await processStripeEvent(
      event("invoice.paid", invoice({ status: "open" })),
    );
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects ambiguous/truncated invoice periods", async () => {
    await expect(
      processStripeEvent(
        event("invoice.paid", invoice({ lines: { has_more: true, data: [] } })),
      ),
    ).rejects.toThrow("Unsupported Stripe invoice period");
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([
    ["active", "active"],
    ["past_due", "past_due"],
    ["unpaid", "past_due"],
    ["incomplete", "past_due"],
    ["paused", "past_due"],
    ["canceled", "canceled"],
    ["incomplete_expired", "expired"],
    ["trialing", "expired"],
  ] as const)(
    "maps actual subscription %s to %s without extending paid period",
    async (status, expected) => {
      expect(membershipStatus(status)).toBe(expected);
      await processStripeEvent(
        event("customer.subscription.updated", {
          id: "sub_1",
          customer: "cus_1",
          status,
          metadata: { orderId: "order-1" },
        }),
      );
      expect(rpc).toHaveBeenCalledWith(
        "apply_stripe_event_v2",
        expect.objectContaining({
          p_membership_status: expected,
          p_period_start: null,
          p_period_end: null,
        }),
      );
    },
  );
  it("normalizes deletion and supports legacy payment-to-order lookup", async () => {
    await processStripeEvent(
      event("customer.subscription.deleted", {
        id: "sub_1",
        customer: "cus_1",
      }),
    );
    expect(from).toHaveBeenCalledWith("payments");
    expect(rpc).toHaveBeenCalledWith(
      "apply_stripe_event_v2",
      expect.objectContaining({ p_membership_status: "canceled" }),
    );
  });
  it("leaves retries/idempotency to the atomic database transition", async () => {
    const input = event("checkout.session.completed", checkout());
    rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });
    await processStripeEvent(input);
    await processStripeEvent(input);
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  });
  it("throws a safe retryable error instead of leaking a database error", async () => {
    rpc.mockResolvedValue({ error: { message: "secret payload" } });
    await expect(
      processStripeEvent(event("invoice.paid", invoice())),
    ).rejects.toThrow("Unable to apply Stripe event transition.");
  });
  it("rejects live envelope and live object without database writes", async () => {
    await expect(
      processStripeEvent({
        ...event("checkout.session.completed", checkout()),
        livemode: true,
      } as Stripe.Event),
    ).rejects.toThrow("test-mode");
    await expect(
      processStripeEvent(
        event("checkout.session.completed", checkout({ livemode: true })),
      ),
    ).rejects.toThrow("test-mode");
    expect(rpc).not.toHaveBeenCalled();
  });
});
