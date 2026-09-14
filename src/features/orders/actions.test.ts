import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, getStripeClient, requireUser } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  createAdminClient: vi.fn(),
  getStripeClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/guards", () => ({ requireUser }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/stripe/server", () => ({ getStripeClient }));

import { startCheckout } from "./actions";

function adminClient(plan: Record<string, unknown> | null) {
  const insertOrder = vi.fn(() => ({
    select: () => ({
      single: async () => ({ data: { id: "order-1" }, error: null }),
    }),
  }));
  const insertItem = vi.fn(async () => ({ error: null }));
  const updateOrder = vi.fn(() => ({ eq: async () => ({ error: null }) }));

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
        if (table === "orders") {
          return { insert: insertOrder, update: updateOrder };
        }
        if (table === "order_items") {
          return { insert: insertItem };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    },
    insertOrder,
    insertItem,
    updateOrder,
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
    getStripeClient.mockReturnValue({
      checkout: {
        sessions: {
          create: vi.fn(async () => ({
            id: "cs_1",
            url: "https://checkout.stripe.test/cs_1",
          })),
        },
      },
    });
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://motion-room.test");
  });

  it("creates a pending order from the re-read plan before creating Checkout", async () => {
    const admin = adminClient({
      id: "plan-1",
      billing_type: "subscription",
      stripe_price_id: "price_database",
      amount_twd_cents: 288000,
      class_credits: 8,
    });
    createAdminClient.mockReturnValue(admin.client);

    const result = await startCheckout({
      planId: "plan-1",
      amountTwdCents: 1,
    } as never);

    expect(result).toEqual({
      ok: true,
      orderId: "order-1",
      checkoutUrl: "https://checkout.stripe.test/cs_1",
    });
    expect(admin.insertOrder).toHaveBeenCalledWith({
      user_id: "user-1",
      status: "pending",
      amount_twd_cents: 288000,
      currency: "twd",
    });
    expect(admin.insertItem).toHaveBeenCalledWith({
      order_id: "order-1",
      plan_id: "plan-1",
      quantity: 1,
      unit_amount_twd_cents: 288000,
    });
    expect(getStripeClient().checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_database", quantity: 1 }],
        metadata: { orderId: "order-1" },
      }),
    );
  });

  it("returns the exact invalid-plan result without creating an order", async () => {
    const admin = adminClient(null);
    createAdminClient.mockReturnValue(admin.client);

    await expect(startCheckout({ planId: "unknown" })).resolves.toEqual({
      ok: false,
      code: "INVALID_PLAN",
      message: "The selected plan is unavailable.",
    });
    expect(admin.insertOrder).not.toHaveBeenCalled();
  });
});
