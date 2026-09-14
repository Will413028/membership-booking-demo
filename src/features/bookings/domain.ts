export type BookingEligibilityInput = {
  status: "active" | "past_due" | "canceled" | "expired";
  startsAt: string;
  remainingSpots: number;
  creditsRemaining: number | null;
};

export type BookingEligibility =
  | { ok: true }
  | {
      ok: false;
      code:
        | "MEMBERSHIP_INACTIVE"
        | "SESSION_STARTED"
        | "SESSION_FULL"
        | "CREDITS_INSUFFICIENT";
    };

export function canBookSession(
  input: BookingEligibilityInput,
  now = new Date(),
): BookingEligibility {
  if (input.status !== "active") {
    return { ok: false, code: "MEMBERSHIP_INACTIVE" };
  }

  const startsAt = new Date(input.startsAt).getTime();
  if (!Number.isFinite(startsAt) || startsAt <= now.getTime()) {
    return { ok: false, code: "SESSION_STARTED" };
  }

  if (input.remainingSpots <= 0) {
    return { ok: false, code: "SESSION_FULL" };
  }

  if (input.creditsRemaining !== null && input.creditsRemaining <= 0) {
    return { ok: false, code: "CREDITS_INSUFFICIENT" };
  }

  return { ok: true };
}
