import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, expect, test, vi } from "vitest";

import { BookingList } from "./booking-list";

const cancelBooking = vi.hoisted(() => vi.fn());

vi.mock("@/features/bookings/actions", () => ({ cancelBooking }));

// jsdom 沒有實作 <dialog> 的 showModal／close
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});

const booking = {
  id: "booking-1",
  className: "Morning Flow Yoga",
  instructorName: "Mia Chen",
  startsAt: "2026-09-22T10:00:00.000Z",
  status: "confirmed" as const,
};

async function confirmCancel() {
  render(<BookingList bookings={[booking]} />);
  fireEvent.click(screen.getByText("取消預約"));
  fireEvent.click(await screen.findByText("確認取消"));
}

test("cancels the booking and shows the success notice", async () => {
  cancelBooking.mockResolvedValue({
    ok: true,
    bookingId: "booking-1",
    creditsRemaining: 4,
  });

  await confirmCancel();

  expect(await screen.findByText("預約已取消。")).toBeInTheDocument();
  expect(cancelBooking).toHaveBeenCalledWith({ bookingId: "booking-1" });
});

test("shows the failure message from the cancel action", async () => {
  cancelBooking.mockResolvedValue({
    ok: false,
    code: "CANCELLATION_CLOSED",
    message: "課程已開始，無法取消。",
  });

  await confirmCancel();

  expect(await screen.findByText("課程已開始，無法取消。")).toBeInTheDocument();
});
