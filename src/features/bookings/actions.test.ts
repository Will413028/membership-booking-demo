import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClient, getActiveMembership, requireUser, revalidatePath } =
  vi.hoisted(() => ({
    createServerClient: vi.fn(),
    getActiveMembership: vi.fn(),
    requireUser: vi.fn(),
    revalidatePath: vi.fn(),
  }));

vi.mock("@/lib/auth/guards", () => ({ requireUser }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("./queries", () => ({ getActiveMembership }));

import { cancelBooking, createBooking } from "./actions";

const membership = {
  id: "membership-1",
  status: "active",
  creditsRemaining: 3,
  currentPeriodEnd: "2030-02-01T00:00:00.000Z",
};

function rpcClient(response: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(response);
  return { client: { rpc }, rpc };
}

describe("booking server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({
      id: "user-1",
      email: "member@example.com",
      role: "member",
    });
    getActiveMembership.mockResolvedValue(membership);
  });

  it("books through the authenticated RPC using the server-derived membership", async () => {
    const database = rpcClient({
      data: [{ booking_id: "booking-1", credits_remaining: 2 }],
      error: null,
    });
    createServerClient.mockResolvedValue(database.client);

    await expect(createBooking({ sessionId: "session-1" })).resolves.toEqual({
      ok: true,
      bookingId: "booking-1",
      creditsRemaining: 2,
    });

    expect(getActiveMembership).toHaveBeenCalledWith("user-1", database.client);
    expect(database.rpc).toHaveBeenCalledWith("book_session", {
      p_session_id: "session-1",
      p_membership_id: "membership-1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/account");
  });

  it("requires a user before querying or calling the booking RPC", async () => {
    const database = rpcClient({ data: null, error: null });
    createServerClient.mockResolvedValue(database.client);
    requireUser.mockRejectedValue({ code: "UNAUTHORIZED" });

    await expect(
      createBooking({ sessionId: "session-1" }),
    ).resolves.toMatchObject({
      ok: false,
      code: "UNAUTHORIZED",
    });

    expect(getActiveMembership).not.toHaveBeenCalled();
    expect(database.rpc).not.toHaveBeenCalled();
  });

  it("rejects a missing active membership without calling the RPC", async () => {
    const database = rpcClient({ data: null, error: null });
    createServerClient.mockResolvedValue(database.client);
    getActiveMembership.mockResolvedValue(null);

    await expect(
      createBooking({ sessionId: "session-1" }),
    ).resolves.toMatchObject({
      ok: false,
      code: "MEMBERSHIP_INACTIVE",
    });

    expect(database.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["SESSION_FULL", "SESSION_FULL"],
    ["DUPLICATE_BOOKING", "DUPLICATE_BOOKING"],
    ["CREDITS_INSUFFICIENT", "CREDITS_INSUFFICIENT"],
    ["SESSION_STARTED", "SESSION_STARTED"],
  ] as const)(
    "maps RPC %s to a stable %s result without a success or cache mutation",
    async (message, code) => {
      const database = rpcClient({
        data: null,
        error: { message: `P0001: ${message}` },
      });
      createServerClient.mockResolvedValue(database.client);

      const result = await createBooking({ sessionId: "session-1" });

      expect(result).toMatchObject({ ok: false, code });
      expect(result).not.toMatchObject({ ok: true });
      expect(revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("cancels through the authenticated RPC and invalidates member booking views", async () => {
    const database = rpcClient({
      data: [{ booking_id: "booking-1", credits_remaining: null }],
      error: null,
    });
    createServerClient.mockResolvedValue(database.client);

    await expect(cancelBooking({ bookingId: "booking-1" })).resolves.toEqual({
      ok: true,
      bookingId: "booking-1",
      creditsRemaining: null,
    });

    expect(database.rpc).toHaveBeenCalledWith("cancel_booking", {
      p_booking_id: "booking-1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/account");
    expect(revalidatePath).toHaveBeenCalledWith("/account/bookings");
  });

  it("maps a started session cancellation to a stable failure without revalidation", async () => {
    const database = rpcClient({
      data: null,
      error: { message: "P0001: SESSION_STARTED" },
    });
    createServerClient.mockResolvedValue(database.client);

    await expect(
      cancelBooking({ bookingId: "booking-1" }),
    ).resolves.toMatchObject({
      ok: false,
      code: "SESSION_STARTED",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
