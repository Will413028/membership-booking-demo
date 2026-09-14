import { render, screen } from "@testing-library/react";

import { ClassCard } from "./class-card";

test("shows the remaining seats and a route to the class session", () => {
  render(
    <ClassCard
      session={{
        id: "session-1",
        classId: "class-1",
        className: "Reformer Foundations",
        category: "Pilates",
        level: "Beginner",
        instructorName: "Leo Wang",
        startsAt: "2026-09-22T10:00:00.000Z",
        endsAt: "2026-09-22T10:50:00.000Z",
        capacity: 8,
        confirmedCount: 5,
        remainingSpots: 3,
      }}
    />,
  );

  expect(screen.getByText("剩餘 3 個名額")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /查看 Reformer Foundations 課程/i }),
  ).toHaveAttribute("href", "/classes/session-1");
});
