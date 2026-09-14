"use client";

import { useState, useTransition } from "react";
import { cancelAccountBooking } from "@/app/(member)/account/bookings/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

import type { MemberBooking } from "./member-summary-card";

function date(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function BookingList({ bookings }: { bookings: MemberBooking[] }) {
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  if (!bookings.length)
    return (
      <Card>
        <h2 className="font-display text-2xl font-bold">尚無預約</h2>
        <p className="mt-2 text-muted-foreground">
          先從課表挑一堂適合今天的課。
        </p>
      </Card>
    );
  const cancel = (bookingId: string) =>
    startTransition(async () => {
      const result = await cancelAccountBooking({ bookingId });
      setNotice(result.ok ? "預約已取消。" : result.message);
    });
  return (
    <div className="space-y-4">
      {bookings.map((booking) => (
        <Card
          key={booking.id}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-display text-xl font-bold">
              {booking.className}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {booking.instructorName} · {date(booking.startsAt)}
            </p>
          </div>
          {booking.status === "confirmed" ? (
            <Dialog>
              <DialogTrigger className="rounded-full border border-ink px-4 py-2 text-sm font-semibold hover:bg-sage">
                取消預約
              </DialogTrigger>
              <DialogContent aria-labelledby={`cancel-${booking.id}`}>
                <h2
                  id={`cancel-${booking.id}`}
                  className="font-display text-2xl font-bold"
                >
                  確定取消這堂課？
                </h2>
                <p className="mt-3 text-muted-foreground">
                  尚未開始且仍在原會員計費期間的預約會退回一堂額度。
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <DialogClose className="rounded-full px-4 py-2 font-semibold">
                    保留預約
                  </DialogClose>
                  <Button
                    disabled={isPending}
                    onClick={() => cancel(booking.id)}
                  >
                    {isPending ? "取消中…" : "確認取消"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <p className="text-sm font-semibold text-muted-foreground">
              已取消
            </p>
          )}
        </Card>
      ))}
      {notice ? (
        <p aria-live="polite" className="text-sm text-olive">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
