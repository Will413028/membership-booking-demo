import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  checkoutCreate,
  checkoutExpire,
  createAdminClient,
  createServerClient,
  getStripeClient,
  requireUser,
} = vi.hoisted(() => ({
  requireUser: vi.fn(),
  createAdminClient: vi.fn(),
  createServerClient: vi.fn(),
  getStripeClient: vi.fn(),
  checkoutCreate: vi.fn(),
  checkoutExpire: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/guards", () => ({ requireUser }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient }));
vi.mock("@/lib/stripe/server", () => ({ getStripeClient }));

import { startCheckout } from "./actions";

const databasePlan = {
  id: "plan-1",
  billing_type: "subscription",
  stripe_price_id: "price_database",
  amount_twd_cents: 288000,
  class_credits: 8,
};

const createdCheckoutOrder = {
  order_id: "order-1",
  plan_id: "plan-1",
  billing_type: "subscription",
  stripe_price_id: "price_database",
  amount_twd_cents: 288000,
  class_credits: 8,
};

function authenticatedClient(plan: Record<string, unknown> | null) {
  const rpc = vi.fn(async (name: string) => {
    if (name === "create_checkout_order") {
      return {
        data: [createdCheckoutOrder],
        error: null,
      };
    }

    if (name === "link_checkout_session" || name === "discard_checkout_order") {
      return { data: true, error: null };
    }

    throw new Error(`Unexpected RPC: ${name}`);
  });

  return {
    client: {
      from: (table: string) => {
        if (table === "plans") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: plan, error: null }),
                }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
      rpc,
    },
    rpc,
  };
}

describe("startCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({
      id: "user-1",
      email: "member@example.com",
      role: "member",
    });
    checkoutCreate.mockResolvedValue({
      id: "cs_1",
      url: "https://checkout.stripe.test/cs_1",
    });
    checkoutExpire.mockResolvedValue({ id: "cs_1", status: "expired" });
    getStripeClient.mockReturnValue({
      checkout: {
        sessions: {
          create: checkoutCreate,
          expire: checkoutExpire,
        },
      },
    });
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://motion-room.test");
  });

  it("uses the authenticated client and ownership-bound RPCs for a database-priced Checkout", async () => {
    const authenticated = authenticatedClient(databasePlan);
    createServerClient.mockResolvedValue(authenticated.client);

    await expect(startCheckout({ planId: "plan-1" })).resolves.toEqual({
      ok: true,
      orderId: "order-1",
      checkoutUrl: "https://checkout.stripe.test/cs_1",
    });

    expect(createAdminClient).not.toHaveBeenCalled();
    expect(authenticated.rpc).toHaveBeenNthCalledWith(
      1,
      "create_checkout_order",
      { p_plan_id: "plan-1" },
    );
    expect(checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_database", quantity: 1 }],
        metadata: { orderId: "order-1" },
      }),
      { idempotencyKey: "checkout-order:order-1" },
    );
    expect(authenticated.rpc).toHaveBeenNthCalledWith(
      2,
      "link_checkout_session",
      { p_order_id: "order-1", p_stripe_checkout_session_id: "cs_1" },
    );
  });

  it("rejects an unconfigured Stripe price before creating a pending order", async () => {
    const authenticated = authenticatedClient({
      ...databasePlan,
      stripe_price_id: null,
    });
    createServerClient.mockResolvedValue(authenticated.client);

    await expect(startCheckout({ planId: "plan-1" })).resolves.toMatchObject({
      ok: false,
      code: "CONFIGURATION_ERROR",
    });

    expect(authenticated.rpc).not.toHaveBeenCalled();
    expect(checkoutCreate).not.toHaveBeenCalled();
  });

  it("discards an unlinked pending order when Stripe session creation fails", async () => {
    const authenticated = authenticatedClient(databasePlan);
    createServerClient.mockResolvedValue(authenticated.client);
    checkoutCreate.mockRejectedValue({ type: "StripeInvalidRequestError" });

    await expect(startCheckout({ planId: "plan-1" })).resolves.toMatchObject({
      ok: false,
      code: "CONFIGURATION_ERROR",
    });

    expect(authenticated.rpc).toHaveBeenLastCalledWith(
      "discard_checkout_order",
      { p_order_id: "order-1" },
    );
    expect(checkoutExpire).not.toHaveBeenCalled();
  });

  it("retries the session link and expires then discards when it remains unlinked", async () => {
    const authenticated = authenticatedClient(databasePlan);
    authenticated.rpc.mockImplementation(async (name: string) => {
      if (name === "create_checkout_order") {
        return {
          data: [createdCheckoutOrder],
          error: null,
        };
      }
      if (name === "link_checkout_session") {
        return { data: false, error: null };
      }
      if (name === "discard_checkout_order") {
        return { data: true, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });
    createServerClient.mockResolvedValue(authenticated.client);

    await expect(startCheckout({ planId: "plan-1" })).resolves.toMatchObject({
      ok: false,
      code: "CONFIGURATION_ERROR",
    });

    expect(checkoutExpire).toHaveBeenCalledWith("cs_1");
    expect(authenticated.rpc).toHaveBeenLastCalledWith(
      "discard_checkout_order",
      { p_order_id: "order-1" },
    );
  });

  it("retains the pending order when a connection failure leaves Checkout creation uncertain", async () => {
    const authenticated = authenticatedClient(databasePlan);
    createServerClient.mockResolvedValue(authenticated.client);
    checkoutCreate.mockRejectedValue({ type: "StripeConnectionError" });

    await expect(startCheckout({ planId: "plan-1" })).resolves.toMatchObject({
      ok: false,
      code: "CONFIGURATION_ERROR",
      recovery: "ORDER_RETAINED",
    });

    expect(checkoutCreate).toHaveBeenCalledTimes(2);
    expect(checkoutExpire).not.toHaveBeenCalled();
    expect(authenticated.rpc).toHaveBeenCalledTimes(1);
  });

  it("retains the pending order when expiry succeeds but discard cannot be confirmed", async () => {
    const authenticated = authenticatedClient(databasePlan);
    authenticated.rpc.mockImplementation(async (name: string) => {
      if (name === "create_checkout_order") {
        return { data: [createdCheckoutOrder], error: null };
      }
      if (name === "link_checkout_session") {
        return { data: false, error: null };
      }
      if (name === "discard_checkout_order") {
        return { data: false, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });
    createServerClient.mockResolvedValue(authenticated.client);

    await expect(startCheckout({ planId: "plan-1" })).resolves.toMatchObject({
      ok: false,
      code: "CONFIGURATION_ERROR",
      recovery: "ORDER_RETAINED",
    });

    expect(checkoutExpire).toHaveBeenCalledTimes(1);
    expect(authenticated.rpc).toHaveBeenLastCalledWith(
      "discard_checkout_order",
      { p_order_id: "order-1" },
    );
    expect(authenticated.rpc).toHaveBeenCalledTimes(5);
  });
});
