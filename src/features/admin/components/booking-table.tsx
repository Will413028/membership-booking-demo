"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table } from "@/components/ui/table";

import { cancelBookingAsAdmin } from "../actions";
import type { AdminBooking } from "../types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function BookingTable({ bookings }: { bookings: AdminBooking[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const cancel = async (bookingId: string) => {
    setPendingId(bookingId);
    setMessage("");
    const result = await cancelBookingAsAdmin({ bookingId });
    setPendingId(null);
    if (!result.ok) {
      setMessage("Booking could not be cancelled.");
      return;
    }
    setMessage(
      result.creditsRemaining === null
        ? "Booking cancelled."
        : `Booking cancelled. Remaining credits: ${result.creditsRemaining}.`,
    );
    router.refresh();
  };

  if (!bookings.length)
    return (
      <p className="rounded-2xl bg-paper p-6 text-muted-foreground">
        No bookings match this search.
      </p>
    );
  return (
    <div className="space-y-3">
      {message && (
        <p aria-live="polite" className="text-sm text-olive">
          {message}
        </p>
      )}
      <Table>
        <thead>
          <tr className="border-b border-border text-sm">
            <th className="p-3">Member</th>
            <th className="p-3">Class</th>
            <th className="p-3">Scheduled</th>
            <th className="p-3">Status</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr
              className="border-b border-border last:border-0"
              key={booking.id}
              data-testid={`booking-${booking.id}`}
            >
              <td className="p-3 font-semibold">{booking.memberName}</td>
              <td className="p-3">{booking.className}</td>
              <td className="p-3 text-sm">{formatDate(booking.startsAt)}</td>
              <td className="p-3">
                <Badge
                  className={
                    booking.status === "confirmed"
                      ? ""
                      : "bg-border text-muted-foreground"
                  }
                >
                  {booking.status}
                </Badge>
              </td>
              <td className="p-3">
                {booking.status === "confirmed" && (
                  <Dialog>
                    <DialogTrigger className="text-sm font-semibold text-coral">
                      Cancel
                    </DialogTrigger>
                    <DialogContent
                      aria-labelledby={`cancel-booking-${booking.id}`}
                    >
                      <h2
                        className="font-display text-xl font-bold"
                        id={`cancel-booking-${booking.id}`}
                      >
                        Cancel booking?
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        This uses the transactional cancellation path and
                        restores credits only when confirmed.
                      </p>
                      <div className="mt-5 flex gap-3">
                        <DialogClose className="rounded-full border border-ink px-4 py-2 text-sm font-semibold">
                          Keep booking
                        </DialogClose>
                        <Button
                          disabled={pendingId === booking.id}
                          onClick={() => cancel(booking.id)}
                          size="sm"
                        >
                          {pendingId === booking.id
                            ? "Cancelling…"
                            : "Confirm cancellation"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
