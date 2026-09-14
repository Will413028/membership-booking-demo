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
    lte: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.gt.mockReturnValue(query);
  query.lte.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data, error: null });

  return { client: { from: vi.fn(() => query) }, query };
}

describe("getActiveMembership", () => {
  it("surfaces query errors instead of silently denying membership", async () => {
    const database = membershipClient(null);
    database.query.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "private error" },
    });
    createServerClient.mockResolvedValue(database.client);
    await expect(getActiveMembership("user-1")).rejects.toThrow(
      "Unable to load data.",
    );
  });

  it("uses an explicit exhausted-only fallback for the action's credit error", async () => {
    const database = membershipClient({
      id: "empty",
      status: "active",
      credits_remaining: 0,
      current_period_end: "2030-01-01",
    });
    createServerClient.mockResolvedValue(database.client);
    expect(
      (await getActiveMembership("user-1", undefined, true))?.creditsRemaining,
    ).toBe(0);
    expect(database.query.or).not.toHaveBeenCalled();
  });
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
    expect(database.query.lte).toHaveBeenCalledWith(
      "current_period_start",
      expect.any(String),
    );
    expect(database.query.or).toHaveBeenCalledWith(
      "credits_remaining.is.null,credits_remaining.gt.0",
    );
    expect(database.query.order.mock.calls).toEqual([
      ["current_period_end", { ascending: true }],
      ["id", { ascending: true }],
    ]);
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
