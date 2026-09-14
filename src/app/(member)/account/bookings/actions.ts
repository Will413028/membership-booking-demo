"use server";

import { cancelBooking } from "@/features/bookings/actions";
import type { CancelBookingResult } from "@/features/bookings/types";

export async function cancelAccountBooking(input: {
  bookingId: string;
}): Promise<CancelBookingResult> {
  return cancelBooking(input);
}
