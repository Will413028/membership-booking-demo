import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClient } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerClient }));

import { getActiveMembership } from "./queries";

function membershipClient(data: unknown) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    gt: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.gt.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data, error: null });

  return { client: { from: vi.fn(() => query) }, query };
}

describe("getActiveMembership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the current active membership with nullable unlimited credits", async () => {
    const database = membershipClient({
      id: "membership-1",
      status: "active",
      credits_remaining: null,
      current_period_end: "2030-02-01T00:00:00.000Z",
    });
    createServerClient.mockResolvedValue(database.client);

    await expect(getActiveMembership("user-1")).resolves.toEqual({
      id: "membership-1",
      status: "active",
      creditsRemaining: null,
      currentPeriodEnd: "2030-02-01T00:00:00.000Z",
    });

    expect(database.query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(database.query.eq).toHaveBeenCalledWith("status", "active");
    expect(database.query.gt).toHaveBeenCalledWith(
      "current_period_end",
      expect.any(String),
    );
  });

  it("returns null when no active membership is available", async () => {
    const database = membershipClient(null);
    createServerClient.mockResolvedValue(database.client);

    await expect(getActiveMembership("user-1")).resolves.toBeNull();
  });
});
