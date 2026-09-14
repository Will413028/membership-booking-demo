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
import { getAdminDashboard, listAdminClasses } from "./queries";

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
  const updateMaybeSingle = vi.fn().mockResolvedValue({
    data: { id: "session-1" },
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
          eq: () => ({
            select: () => ({
              single: insertSingle,
              maybeSingle: updateMaybeSingle,
            }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  return {
    client: { from, rpc: vi.fn() },
    from,
    maybeSingle,
    insertSingle,
    updateMaybeSingle,
  };
}

function dashboardClient({
  orders = { data: [], error: null },
  profiles = { data: [], error: null },
  memberships = { data: [], error: null },
  bookings = { data: [], error: null },
  sessions = { data: [], error: null },
}: {
  orders?: { data: unknown; error: unknown };
  profiles?: { data: unknown; error: unknown };
  memberships?: { data: unknown; error: unknown };
  bookings?: { data: unknown; error: unknown };
  sessions?: { data: unknown; error: unknown };
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "orders")
        return { select: () => ({ eq: async () => orders }) };
      if (table === "profiles")
        return { select: () => ({ eq: async () => profiles }) };
      if (table === "memberships")
        return { select: () => ({ eq: async () => memberships }) };
      if (table === "bookings")
        return { select: () => ({ eq: async () => bookings }) };
      if (table === "class_sessions") {
        return {
          select: () => ({
            gte: () => ({ lt: () => ({ order: async () => sessions }) }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
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

  it("surfaces a safe error instead of rendering a partial dashboard when a query fails", async () => {
    const database = dashboardClient({
      orders: { data: null, error: { message: "sensitive database detail" } },
    });
    createServerClient.mockResolvedValue(database);

    await expect(getAdminDashboard()).rejects.toThrow(
      "Unable to load admin data.",
    );
  });

  it("counts distinct users with active memberships rather than every member profile", async () => {
    const database = dashboardClient({
      memberships: {
        data: [
          { user_id: "member-1" },
          { user_id: "member-1" },
          { user_id: "member-2" },
        ],
        error: null,
      },
    });
    createServerClient.mockResolvedValue(database);

    await expect(getAdminDashboard()).resolves.toMatchObject({
      activeMemberCount: 2,
    });
    expect(database.from).toHaveBeenCalledWith("memberships");
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

  it("allows an edit to preserve its current inactive class but rejects a different inactive class", async () => {
    const updateSingle = vi.fn().mockResolvedValue({
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
    const database = {
      client: {
        from: vi.fn((table: string) => {
          if (table === "class_sessions") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { class_id: "class-1" },
                    error: null,
                  }),
                }),
              }),
              update: () => ({
                eq: () => ({ select: () => ({ single: updateSingle }) }),
              }),
            };
          }
          if (table === "classes") {
            return {
              select: () => ({
                eq: (_field: string, classId: string) => ({
                  maybeSingle: async () => ({
                    data: {
                      id: classId,
                      instructor_name: "Ada Lin",
                      active: false,
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
      },
    };
    createServerClient.mockResolvedValue(database.client);

    await expect(
      updateClassSession({ id: "session-1", ...validSession }),
    ).resolves.toMatchObject({ ok: true });

    await expect(
      updateClassSession({
        id: "session-1",
        ...validSession,
        classId: "class-2",
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
      fieldErrors: { classId: expect.any(String) },
    });
  });

  it("returns DATABASE_ERROR instead of success when a session to toggle is absent", async () => {
    const database = sessionClient();
    createServerClient.mockResolvedValue(database.client);
    database.updateMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      setSessionActive({ sessionId: "missing-session", active: false }),
    ).resolves.toEqual({ ok: false, code: "DATABASE_ERROR" });
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

  it("rejects malformed cancellation payloads without reading a property or calling the RPC", async () => {
    const database = sessionClient();
    createServerClient.mockResolvedValue(database.client);

    await expect(cancelBookingAsAdmin(null as never)).resolves.toMatchObject({
      ok: false,
      code: "BOOKING_NOT_FOUND",
    });
    expect(database.client.rpc).not.toHaveBeenCalled();
  });

  it("returns active classes for new sessions and only the current inactive class for edits", async () => {
    const classes = [
      { id: "active", name: "Active", instructor_name: "Ada", active: true },
      { id: "current", name: "Current", instructor_name: "Bea", active: false },
      { id: "other", name: "Other", instructor_name: "Cy", active: false },
    ];
    const database = {
      client: {
        from: vi.fn(() => ({
          select: () => ({
            order: async () => ({ data: classes, error: null }),
          }),
        })),
      },
    };
    createServerClient.mockResolvedValue(database.client);

    await expect(listAdminClasses({ mode: "new" })).resolves.toEqual([
      { id: "active", name: "Active", instructorName: "Ada", active: true },
    ]);
    await expect(
      listAdminClasses({ mode: "edit", includeInactiveClassId: "current" }),
    ).resolves.toEqual([
      { id: "active", name: "Active", instructorName: "Ada", active: true },
      { id: "current", name: "Current", instructorName: "Bea", active: false },
    ]);
  });
});
