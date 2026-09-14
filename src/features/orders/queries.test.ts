import { expect, it, vi } from "vitest";

const { createServerClient } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createServerClient }));
vi.mock("@/lib/auth/guards", () => ({
  requireUser: async () => ({ id: "u1" }),
}));

import { getOrderStatus } from "./queries";

function database(membership: unknown, error: unknown = null) {
  const eq = vi.fn();
  const from = vi.fn((table: string) => {
    const query = {
      select: () => query,
      eq: (...args: unknown[]) => {
        eq(...args);
        return query;
      },
      maybeSingle: async () =>
        table === "orders"
          ? { data: { id: "o1", status: "paid" }, error: null }
          : { data: membership, error },
    };
    return query;
  });
  createServerClient.mockResolvedValue({ from });
  return eq;
}
it("does not claim activation from another purchase of the same plan", async () => {
  const eq = database(null);
  expect((await getOrderStatus("o1")).membershipActive).toBe(false);
  expect(eq).toHaveBeenCalledWith("source_order_id", "o1");
});
it("requires a current paid-order membership", async () => {
  database({
    status: "active",
    current_period_start: "2020-01-01",
    current_period_end: "2099-01-01",
  });
  expect((await getOrderStatus("o1")).membershipActive).toBe(true);
});
it("does not hide a membership query outage as pending", async () => {
  database(null, { message: "private detail" });
  await expect(getOrderStatus("o1")).rejects.toThrow("Unable to load data.");
});
