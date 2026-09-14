import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClient, requireAdmin, revalidatePath } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({ requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient }));
vi.mock("next/cache", () => ({ revalidatePath }));

import {
  cancelBookingAsAdmin,
  createClassSession,
  setSessionActive,
  updateClassSession,
} from "./actions";
import { getAdminDashboard } from "./queries";

const validSession = {
  classId: "class-1",
  startsAt: "2030-06-01T09:00:00.000Z",
  endsAt: "2030-06-01T10:00:00.000Z",
  capacity: 12,
  instructorName: "Ada Lin",
};

function sessionClient() {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { id: "class-1", instructor_name: "Ada Lin", active: true },
    error: null,
  });
  const insertSingle = vi.fn().mockResolvedValue({
    data: {
      id: "session-1",
      class_id: "class-1",
      starts_at: validSession.startsAt,
      ends_at: validSession.endsAt,
      capacity: 12,
      active: true,
    },
    error: null,
  });
  const from = vi.fn((table: string) => {
    if (table === "classes") {
      return {
        select: () => ({ eq: () => ({ maybeSingle }) }),
      };
    }
    if (table === "class_sessions") {
      return {
        insert: () => ({ select: () => ({ single: insertSingle }) }),
        update: () => ({
          eq: () => ({ select: () => ({ single: insertSingle }) }),
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  return { client: { from, rpc: vi.fn() }, from, maybeSingle, insertSingle };
}

describe("admin server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      role: "admin",
    });
  });

  it("rejects a member before the dashboard touches any data", async () => {
    const database = sessionClient();
    createServerClient.mockResolvedValue(database.client);
    requireAdmin.mockRejectedValue({ code: "FORBIDDEN" });

    await expect(getAdminDashboard()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(database.from).not.toHaveBeenCalled();
  });

  it.each([
    ["create", () => createClassSession(validSession)],
    ["update", () => updateClassSession({ id: "session-1", ...validSession })],
    [
      "toggle",
      () => setSessionActive({ sessionId: "session-1", active: false }),
    ],
    ["cancel", () => cancelBookingAsAdmin({ bookingId: "booking-1" })],
  ])(
    "rejects a member before a %s mutation touches data",
    async (_, action) => {
      const database = sessionClient();
      createServerClient.mockResolvedValue(database.client);
      requireAdmin.mockRejectedValue({ code: "FORBIDDEN" });

      await expect(action()).resolves.toMatchObject({
        ok: false,
        code: "FORBIDDEN",
      });
      expect(database.from).not.toHaveBeenCalled();
      expect(database.client.rpc).not.toHaveBeenCalled();
    },
  );

  it("creates a valid session after validating the selected class and instructor", async () => {
    const database = sessionClient();
    createServerClient.mockResolvedValue(database.client);

    await expect(createClassSession(validSession)).resolves.toEqual({
      ok: true,
      data: {
        id: "session-1",
        classId: "class-1",
        startsAt: "2030-06-01T09:00:00.000Z",
        endsAt: "2030-06-01T10:00:00.000Z",
        capacity: 12,
        active: true,
        instructorName: "Ada Lin",
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/schedules");
  });

  it.each([
    ["capacity", { ...validSession, capacity: 0 }, "capacity"],
    [
      "time range",
      { ...validSession, endsAt: "2030-06-01T09:00:00.000Z" },
      "endsAt",
    ],
    [
      "missing instructor",
      { ...validSession, instructorName: "" },
      "instructorName",
    ],
  ])("returns a stable field error for invalid %s", async (_, input, field) => {
    const database = sessionClient();
    createServerClient.mockResolvedValue(database.client);

    await expect(createClassSession(input)).resolves.toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
      fieldErrors: { [field]: expect.any(String) },
    });
    expect(database.from).not.toHaveBeenCalled();
  });

  it("returns a classId field error when the class is unknown", async () => {
    const database = sessionClient();
    database.maybeSingle.mockResolvedValue({ data: null, error: null });
    createServerClient.mockResolvedValue(database.client);

    await expect(createClassSession(validSession)).resolves.toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      fieldErrors: { classId: "Class not found." },
    });
  });

  it("cancels through the transactional RPC and only returns credits after it succeeds", async () => {
    const database = sessionClient();
    database.client.rpc.mockResolvedValue({
      data: [{ booking_id: "booking-1", credits_remaining: 4 }],
      error: null,
    });
    createServerClient.mockResolvedValue(database.client);

    await expect(
      cancelBookingAsAdmin({ bookingId: "booking-1" }),
    ).resolves.toEqual({
      ok: true,
      bookingId: "booking-1",
      creditsRemaining: 4,
    });
    expect(database.client.rpc).toHaveBeenCalledWith("cancel_booking", {
      p_booking_id: "booking-1",
    });
  });
});
