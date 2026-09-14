export type BookingFailureCode =
  | "UNAUTHORIZED"
  | "MEMBERSHIP_INACTIVE"
  | "SESSION_FULL"
  | "DUPLICATE_BOOKING"
  | "CREDITS_INSUFFICIENT"
  | "SESSION_STARTED";

export type BookingResult =
  | { ok: true; bookingId: string; creditsRemaining: number | null }
  | { ok: false; code: BookingFailureCode; message: string };

export type CancelBookingFailureCode =
  | "UNAUTHORIZED"
  | "BOOKING_NOT_FOUND"
  | "BOOKING_CANCELLED"
  | "SESSION_STARTED";

export type CancelBookingResult =
  | { ok: true; bookingId: string; creditsRemaining: number | null }
  | { ok: false; code: CancelBookingFailureCode; message: string };
