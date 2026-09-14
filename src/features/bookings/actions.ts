"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/types";
import { createServerClient } from "@/lib/supabase/server";

import { getActiveMembership } from "./queries";
import type {
  BookingFailureCode,
  BookingResult,
  CancelBookingFailureCode,
  CancelBookingResult,
} from "./types";

type BookingRpcRow = {
  booking_id: string;
  credits_remaining: number | null;
};

const bookingMessages: Record<BookingFailureCode, string> = {
  UNAUTHORIZED: "Please sign in to manage bookings.",
  MEMBERSHIP_INACTIVE: "An active membership is required to book this session.",
  SESSION_FULL: "This session is full.",
  DUPLICATE_BOOKING: "You already have a booking for this session.",
  CREDITS_INSUFFICIENT: "You do not have enough class credits.",
  SESSION_STARTED: "This session has already started.",
};

const cancelMessages: Record<CancelBookingFailureCode, string> = {
  UNAUTHORIZED: "Please sign in to manage bookings.",
  BOOKING_NOT_FOUND: "This booking is no longer available.",
  BOOKING_CANCELLED: "This booking has already been cancelled.",
  SESSION_STARTED: "This session has already started.",
};

function hasDatabaseCode(error: unknown, code: string): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.includes(code)
  );
}

function isBookingRpcRow(value: unknown): value is BookingRpcRow {
  if (!value || typeof value !== "object") {
    return false;
  }

  const row = value as Partial<BookingRpcRow>;
  return (
    typeof row.booking_id === "string" &&
    (typeof row.credits_remaining === "number" ||
      row.credits_remaining === null)
  );
}

function rpcRow(value: unknown): BookingRpcRow | null {
  const row = Array.isArray(value) ? value[0] : value;
  return isBookingRpcRow(row) ? row : null;
}

function bookingFailure(code: BookingFailureCode): BookingResult {
  return { ok: false, code, message: bookingMessages[code] };
}

function cancelFailure(code: CancelBookingFailureCode): CancelBookingResult {
  return { ok: false, code, message: cancelMessages[code] };
}

function mapBookingError(error: unknown): BookingResult {
  const codes: BookingFailureCode[] = [
    "SESSION_FULL",
    "DUPLICATE_BOOKING",
    "CREDITS_INSUFFICIENT",
    "SESSION_STARTED",
    "MEMBERSHIP_INACTIVE",
    "UNAUTHORIZED",
  ];
  const code = codes.find((candidate) => hasDatabaseCode(error, candidate));
  return bookingFailure(code ?? "UNAUTHORIZED");
}

function mapCancellationError(error: unknown): CancelBookingResult {
  const codes: CancelBookingFailureCode[] = [
    "BOOKING_NOT_FOUND",
    "BOOKING_CANCELLED",
    "SESSION_STARTED",
    "UNAUTHORIZED",
  ];
  const code = codes.find((candidate) => hasDatabaseCode(error, candidate));
  return cancelFailure(code ?? "UNAUTHORIZED");
}

export async function createBooking(input: {
  sessionId: string;
}): Promise<BookingResult> {
  const supabase = await createServerClient();
  let user: SessionUser;
  try {
    user = await requireUser(supabase);
  } catch {
    return bookingFailure("UNAUTHORIZED");
  }

  const membership = await getActiveMembership(user.id, supabase);
  if (!membership) {
    return bookingFailure("MEMBERSHIP_INACTIVE");
  }

  try {
    const { data, error } = await supabase.rpc("book_session", {
      p_session_id: input.sessionId,
      p_membership_id: membership.id,
    });
    if (error) {
      return mapBookingError(error);
    }

    const booking = rpcRow(data);
    if (!booking) {
      return bookingFailure("UNAUTHORIZED");
    }

    revalidatePath("/account");
    return {
      ok: true,
      bookingId: booking.booking_id,
      creditsRemaining: booking.credits_remaining,
    };
  } catch (error) {
    return mapBookingError(error);
  }
}

export async function cancelBooking(input: {
  bookingId: string;
}): Promise<CancelBookingResult> {
  const supabase = await createServerClient();
  try {
    await requireUser(supabase);
  } catch {
    return cancelFailure("UNAUTHORIZED");
  }

  try {
    const { data, error } = await supabase.rpc("cancel_booking", {
      p_booking_id: input.bookingId,
    });
    if (error) {
      return mapCancellationError(error);
    }

    const booking = rpcRow(data);
    if (!booking) {
      return cancelFailure("UNAUTHORIZED");
    }

    revalidatePath("/account");
    revalidatePath("/account/bookings");
    return {
      ok: true,
      bookingId: booking.booking_id,
      creditsRemaining: booking.credits_remaining,
    };
  } catch (error) {
    return mapCancellationError(error);
  }
}
