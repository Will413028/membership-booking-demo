import { describe, expect, it } from "vitest";

import {
  buildCheckoutSessionParams,
  CheckoutConfigurationError,
} from "./checkout";

describe("buildCheckoutSessionParams", () => {
  it("uses the database subscription price without accepting a client amount", () => {
    const params = buildCheckoutSessionParams({
      orderId: "order-1",
      plan: {
        id: "plan-1",
        stripePriceId: "price_subscription",
        billingType: "subscription",
      },
      customerEmail: "member@example.com",
      siteUrl: "https://motion-room.test",
      // A caller cannot influence the Checkout price with an extra client field.
      amountTwdCents: 1,
    } as never);

    expect(params).toMatchObject({
      mode: "subscription",
      customer_email: "member@example.com",
      metadata: { orderId: "order-1" },
      subscription_data: { metadata: { orderId: "order-1" } },
      success_url:
        "https://motion-room.test/checkout/success?order_id=order-1&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://motion-room.test/checkout/cancel?order_id=order-1",
    });
    expect(params.line_items?.[0]).toEqual({
      price: "price_subscription",
      quantity: 1,
    });
    expect(params.line_items?.[0]).not.toHaveProperty("price_data");
  });

  it("uses payment mode for a database one-time plan", () => {
    const params = buildCheckoutSessionParams({
      orderId: "order-2",
      plan: {
        id: "plan-2",
        stripePriceId: "price_one_time",
        billingType: "one_time",
      },
      customerEmail: "member@example.com",
      siteUrl: "https://motion-room.test",
    });

    expect(params.mode).toBe("payment");
    expect(params.line_items?.[0]?.price).toBe("price_one_time");
  });

  it("rejects a database plan without a configured Stripe price", () => {
    expect(() =>
      buildCheckoutSessionParams({
        orderId: "order-3",
        plan: {
          id: "plan-3",
          stripePriceId: "",
          billingType: "subscription",
        },
        customerEmail: "member@example.com",
        siteUrl: "https://motion-room.test",
      }),
    ).toThrow(CheckoutConfigurationError);
  });
});
