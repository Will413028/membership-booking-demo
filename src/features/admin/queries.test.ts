import { beforeEach, expect, it, vi } from "vitest";

const { createServerClient } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createServerClient }));
vi.mock("@/lib/auth/guards", () => ({ requireAdmin: vi.fn() }));

import {
  listAdminBookings,
  listAdminMembers,
  listAdminOrders,
  listAdminSchedules,
} from "./queries";

function database(data: unknown, error: unknown = null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are intentionally thenable.
    then: (resolve: (value: unknown) => void) => resolve({ data, error }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  createServerClient.mockResolvedValue({ from: () => query });
  return query;
}
beforeEach(() => vi.clearAllMocks());
it("maps profiles and nested classes from real to-one embeddings", async () => {
  database([
    {
      id: "b1",
      status: "confirmed",
      created_at: "2030-01-01",
      cancelled_at: null,
      profiles: { full_name: "Member" },
      class_sessions: { starts_at: "2030-02-01", classes: { name: "Yoga" } },
    },
  ]);
  expect(await listAdminBookings()).toEqual([
    expect.objectContaining({
      memberName: "Member",
      className: "Yoga",
      startsAt: "2030-02-01",
    }),
  ]);
});
it("maps reverse membership embedding", async () => {
  database([
    {
      id: "u1",
      full_name: "Member",
      memberships: [
        {
          status: "active",
          credits_remaining: 7,
          current_period_end: "2030-02-01",
        },
      ],
    },
  ]);
  expect(await listAdminMembers()).toEqual([
    expect.objectContaining({
      membershipStatus: "active",
      creditsRemaining: 7,
    }),
  ]);
});
it("maps order buyer and plan, including array relation compatibility", async () => {
  database([
    {
      id: "o1",
      status: "paid",
      amount_twd_cents: 68000,
      created_at: "2030-01-01",
      profiles: [{ full_name: "Member" }],
      order_items: [{ plans: [{ name: "Single Class" }] }],
    },
  ]);
  expect(await listAdminOrders()).toEqual([
    expect.objectContaining({ memberName: "Member", planName: "Single Class" }),
  ]);
});
it("uses confirmed-only relation counts in schedules", async () => {
  const query = database([
    {
      id: "s1",
      class_id: "c1",
      starts_at: "2030-01-01",
      ends_at: "2030-01-02",
      capacity: 3,
      active: true,
      classes: {
        id: "c1",
        name: "Yoga",
        category: "Yoga",
        instructor_name: "Ada",
        active: true,
      },
      bookings: [{ count: 2 }],
    },
  ]);
  expect(await listAdminSchedules()).toEqual([
    expect.objectContaining({ confirmedCount: 2 }),
  ]);
  expect(query.select).toHaveBeenCalledWith(
    expect.stringContaining("bookings(count)"),
  );
  expect(query.eq).toHaveBeenCalledWith("bookings.status", "confirmed");
});
it.each([
  listAdminBookings,
  listAdminMembers,
  listAdminOrders,
  listAdminSchedules,
])("surfaces safe query failure", async (load) => {
  database(null, { message: "private detail" });
  await expect(load()).rejects.toThrow("Unable to load admin data.");
});
