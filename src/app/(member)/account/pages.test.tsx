import { beforeEach, expect, it, vi } from "vitest";

const { createServerClient } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createServerClient }));
vi.mock("@/lib/auth/account", () => ({
  requireAccountUser: async () => ({ id: "u1" }),
}));
vi.mock("@/features/member/components/booking-list", () => ({
  BookingList: () => null,
}));
vi.mock("@/features/member/components/order-list", () => ({
  OrderList: () => null,
}));
vi.mock("@/features/member/components/member-summary-card", () => ({
  MemberSummaryCard: () => null,
}));

import BookingsPage from "./bookings/page";
import OrdersPage from "./orders/page";
import AccountPage from "./page";

function database(failingTable?: string) {
  const calls: Array<unknown[]> = [];
  createServerClient.mockResolvedValue({
    from: (table: string) => {
      const result = {
        data: table === "memberships" ? null : [],
        error: table === failingTable ? { message: "private DB detail" } : null,
      };
      const query = {
        select: (value: string) => {
          calls.push([table, "select", value]);
          return query;
        },
        eq: (key: string, value: string) => {
          calls.push([table, "eq", key, value]);
          return query;
        },
        gt: (key: string, value: string) => {
          calls.push([table, "gt", key, value]);
          return query;
        },
        order: (key: string, value: unknown) => {
          calls.push([table, "order", key, value]);
          return query;
        },
        limit: () => query,
        maybeSingle: async () => result,
        // biome-ignore lint/suspicious/noThenProperty: Matches the awaited Supabase query builder.
        then: (resolve: (result: unknown) => void) => resolve(result),
      };
      return query;
    },
  });
  return calls;
}
beforeEach(() => vi.clearAllMocks());
it.each(["memberships", "bookings", "orders"])(
  "dashboard surfaces %s failure",
  async (table) => {
    database(table);
    await expect(AccountPage()).rejects.toThrow("Unable to load data.");
  },
);
it.each([
  [BookingsPage, "bookings"],
  [OrdersPage, "orders"],
] as const)("member list surfaces a safe data error", async (page, table) => {
  database(table);
  await expect(page()).rejects.toThrow("Unable to load data.");
});
it("allows genuinely empty member data and orders next booking by earliest future session", async () => {
  const calls = database();
  await expect(AccountPage()).resolves.toBeTruthy();
  expect(calls).toContainEqual(["bookings", "eq", "status", "confirmed"]);
  expect(calls).toContainEqual([
    "bookings",
    "gt",
    "class_sessions.starts_at",
    expect.any(String),
  ]);
  expect(calls).toContainEqual([
    "bookings",
    "order",
    "class_sessions(starts_at)",
    { ascending: true },
  ]);
  expect(calls).not.toContainEqual([
    "bookings",
    "order",
    "created_at",
    expect.anything(),
  ]);
  await expect(BookingsPage()).resolves.toBeTruthy();
  await expect(OrdersPage()).resolves.toBeTruthy();
});
