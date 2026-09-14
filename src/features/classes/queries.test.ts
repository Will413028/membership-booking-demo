import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClient } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerClient }));

import { getSessionDetails, listUpcomingSessions } from "./queries";

const session = {
  id: "session-1",
  class_id: "class-1",
  starts_at: "2030-01-02T10:00:00.000Z",
  ends_at: "2030-01-02T11:00:00.000Z",
  capacity: 8,
  classes: {
    name: "Morning Flow",
    category: "Yoga",
    level: "Beginner",
    description: "A calm practice.",
    instructor_name: "Mina",
  },
};

function sessionsClient(sessionData: unknown, countData: unknown) {
  const sessionQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    gt: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
  };
  sessionQuery.select.mockReturnValue(sessionQuery);
  sessionQuery.eq.mockReturnValue(sessionQuery);
  sessionQuery.gt.mockReturnValue(sessionQuery);
  sessionQuery.gte.mockReturnValue(sessionQuery);
  sessionQuery.lte.mockReturnValue(sessionQuery);
  sessionQuery.order.mockReturnValue(sessionQuery);
  sessionQuery.maybeSingle.mockResolvedValue({
    data: sessionData,
    error: null,
  });
  sessionQuery.order.mockResolvedValue({ data: sessionData, error: null });

  const countQuery = {
    select: vi.fn(),
    in: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  countQuery.select.mockReturnValue(countQuery);
  countQuery.in.mockResolvedValue({ data: countData, error: null });
  countQuery.eq.mockReturnValue(countQuery);
  countQuery.maybeSingle.mockResolvedValue({ data: countData, error: null });

  return {
    client: {
      from: vi.fn((table: string) =>
        table === "class_sessions" ? sessionQuery : countQuery,
      ),
    },
    sessionQuery,
    countQuery,
  };
}

describe("class session queries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists only future active sessions and derives non-negative availability from confirmed bookings", async () => {
    const database = sessionsClient(
      [{ ...session }, { ...session, id: "session-2", capacity: 2 }],
      [
        { session_id: "session-1", confirmed_count: 3 },
        { session_id: "session-2", confirmed_count: 3 },
      ],
    );
    createServerClient.mockResolvedValue(database.client);

    await expect(listUpcomingSessions({ category: "Yoga" })).resolves.toEqual([
      {
        id: "session-1",
        classId: "class-1",
        className: "Morning Flow",
        category: "Yoga",
        level: "Beginner",
        instructorName: "Mina",
        startsAt: "2030-01-02T10:00:00.000Z",
        endsAt: "2030-01-02T11:00:00.000Z",
        capacity: 8,
        confirmedCount: 3,
        remainingSpots: 5,
      },
      {
        id: "session-2",
        classId: "class-1",
        className: "Morning Flow",
        category: "Yoga",
        level: "Beginner",
        instructorName: "Mina",
        startsAt: "2030-01-02T10:00:00.000Z",
        endsAt: "2030-01-02T11:00:00.000Z",
        capacity: 2,
        confirmedCount: 3,
        remainingSpots: 0,
      },
    ]);

    expect(database.sessionQuery.eq).toHaveBeenCalledWith("active", true);
    expect(database.sessionQuery.gt).toHaveBeenCalledWith(
      "starts_at",
      expect.any(String),
    );
    expect(database.sessionQuery.eq).toHaveBeenCalledWith(
      "classes.active",
      true,
    );
    expect(database.sessionQuery.eq).toHaveBeenCalledWith(
      "classes.category",
      "Yoga",
    );
    expect(database.client.from).toHaveBeenCalledWith(
      "session_confirmed_booking_counts",
    );
    expect(database.countQuery.in).toHaveBeenCalledWith("session_id", [
      "session-1",
      "session-2",
    ]);
  });

  it("returns class and instructor details for a future active session", async () => {
    const database = sessionsClient(session, [
      { session_id: "session-1", confirmed_count: 3 },
    ]);
    createServerClient.mockResolvedValue(database.client);

    await expect(getSessionDetails("session-1")).resolves.toEqual({
      id: "session-1",
      classId: "class-1",
      className: "Morning Flow",
      category: "Yoga",
      level: "Beginner",
      description: "A calm practice.",
      instructorName: "Mina",
      startsAt: "2030-01-02T10:00:00.000Z",
      endsAt: "2030-01-02T11:00:00.000Z",
      capacity: 8,
      confirmedCount: 3,
      remainingSpots: 5,
    });
  });

  it("normalizes the relationship array shape returned by an untyped Supabase client", async () => {
    const database = sessionsClient(
      [{ ...session, classes: [session.classes] }],
      [{ session_id: "session-1", confirmed_count: 3 }],
    );
    createServerClient.mockResolvedValue(database.client);

    await expect(listUpcomingSessions({})).resolves.toMatchObject([
      {
        id: "session-1",
        className: "Morning Flow",
        instructorName: "Mina",
        confirmedCount: 3,
      },
    ]);
  });

  it("returns null when a session cannot be read as an active future session", async () => {
    const database = sessionsClient(null, null);
    createServerClient.mockResolvedValue(database.client);

    await expect(getSessionDetails("missing")).resolves.toBeNull();
  });

  it("throws a safe failure when the database is unavailable instead of an empty schedule", async () => {
    const database = sessionsClient(null, null);
    database.sessionQuery.order.mockResolvedValue({
      data: null,
      error: { message: "private detail" },
    });
    createServerClient.mockResolvedValue(database.client);
    await expect(listUpcomingSessions({})).rejects.toThrow(
      "Unable to load data.",
    );
  });

  it("does not report not-found when the detail query fails", async () => {
    const database = sessionsClient(null, null);
    database.sessionQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "private detail" },
    });
    createServerClient.mockResolvedValue(database.client);
    await expect(getSessionDetails("session-1")).rejects.toThrow(
      "Unable to load data.",
    );
  });
});
