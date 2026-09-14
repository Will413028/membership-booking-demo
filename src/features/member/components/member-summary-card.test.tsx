import { render, screen } from "@testing-library/react";

import { MemberSummaryCard } from "./member-summary-card";

const nextBooking = {
  id: "booking-1",
  className: "Morning Flow Yoga",
  instructorName: "Mia Chen",
  startsAt: "2026-09-22T10:00:00.000Z",
  status: "confirmed" as const,
};

test("shows finite remaining membership credits", () => {
  render(
    <MemberSummaryCard
      data={{
        membership: {
          name: "Starter 8",
          status: "active",
          creditsRemaining: 5,
          currentPeriodEnd: "2026-10-15T00:00:00.000Z",
        },
        nextBooking,
        recentOrders: [],
      }}
    />,
  );

  expect(screen.getByText("5 堂剩餘")).toBeInTheDocument();
});

test("shows unlimited credits when a membership has no credit cap", () => {
  render(
    <MemberSummaryCard
      data={{
        membership: {
          name: "Unlimited",
          status: "active",
          creditsRemaining: null,
          currentPeriodEnd: "2026-10-15T00:00:00.000Z",
        },
        nextBooking,
        recentOrders: [],
      }}
    />,
  );

  expect(screen.getByText("不限堂數")).toBeInTheDocument();
});
