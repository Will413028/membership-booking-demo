import { describe, expect, it } from "vitest";

import { canBookSession } from "./domain";

const future = "2030-01-02T10:00:00.000Z";
const started = "2030-01-01T09:00:00.000Z";
const now = new Date("2030-01-01T10:00:00.000Z");

describe("canBookSession", () => {
  it("allows an active member with a future session, availability, and credits", () => {
    expect(
      canBookSession(
        {
          status: "active",
          startsAt: future,
          remainingSpots: 1,
          creditsRemaining: 1,
        },
        now,
      ),
    ).toEqual({ ok: true });
  });

  it("rejects inactive membership before every session or credit condition", () => {
    expect(
      canBookSession(
        {
          status: "expired",
          startsAt: started,
          remainingSpots: 0,
          creditsRemaining: 0,
        },
        now,
      ),
    ).toMatchObject({ ok: false, code: "MEMBERSHIP_INACTIVE" });
  });

  it("rejects a started session before capacity or credit conditions", () => {
    expect(
      canBookSession(
        {
          status: "active",
          startsAt: started,
          remainingSpots: 0,
          creditsRemaining: 0,
        },
        now,
      ),
    ).toMatchObject({ ok: false, code: "SESSION_STARTED" });
  });

  it("rejects a full session before finite credit exhaustion", () => {
    expect(
      canBookSession(
        {
          status: "active",
          startsAt: future,
          remainingSpots: 0,
          creditsRemaining: 0,
        },
        now,
      ),
    ).toMatchObject({ ok: false, code: "SESSION_FULL" });
  });

  it("rejects exhausted finite credits", () => {
    expect(
      canBookSession(
        {
          status: "active",
          startsAt: future,
          remainingSpots: 1,
          creditsRemaining: 0,
        },
        now,
      ),
    ).toMatchObject({ ok: false, code: "CREDITS_INSUFFICIENT" });
  });

  it("allows an unlimited membership represented by null credits", () => {
    expect(
      canBookSession(
        {
          status: "active",
          startsAt: future,
          remainingSpots: 1,
          creditsRemaining: null,
        },
        now,
      ),
    ).toEqual({ ok: true });
  });
});
