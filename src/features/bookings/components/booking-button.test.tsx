import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, vi } from "vitest";

const { createBooking, refresh } = vi.hoisted(() => ({
  createBooking: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("../actions", () => ({ createBooking }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { BookingButton } from "./booking-button";

beforeEach(() => {
  vi.clearAllMocks();
});

test("shows confirmed status only after the booking action succeeds", async () => {
  createBooking.mockResolvedValue({
    ok: true,
    bookingId: "booking-1",
    creditsRemaining: 7,
  });
  render(<BookingButton sessionId="session-1" full={false} />);

  fireEvent.click(screen.getByRole("button", { name: "預約這堂課" }));

  await waitFor(() =>
    expect(screen.getByText("預約已確認")).toBeInTheDocument(),
  );
  expect(createBooking).toHaveBeenCalledWith({ sessionId: "session-1" });
  expect(refresh).toHaveBeenCalled();
});

test("shows the server action message and disables a full session", async () => {
  createBooking.mockResolvedValue({
    ok: false,
    code: "DUPLICATE_BOOKING",
    message: "You already have a booking for this session.",
  });
  const { rerender } = render(
    <BookingButton sessionId="session-1" full={false} />,
  );

  fireEvent.click(screen.getByRole("button", { name: "預約這堂課" }));
  await waitFor(() =>
    expect(
      screen.getByText("You already have a booking for this session."),
    ).toBeInTheDocument(),
  );

  rerender(<BookingButton sessionId="session-1" full />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "本堂已額滿" })).toBeDisabled(),
  );
});
