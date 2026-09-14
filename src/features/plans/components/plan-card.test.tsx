import { render, screen } from "@testing-library/react";

import { PlanCard } from "./plan-card";

test("Single Class describes a one-time 30-day grant, not monthly credits", () => {
  render(
    <PlanCard
      plan={{
        id: "single",
        code: "single-class",
        billingType: "one_time",
        classCredits: 1,
        amountTwdCents: 68000,
      }}
      isAuthenticated={false}
    />,
  );
  expect(screen.getByText("1 堂，付款後 30 天有效")).toBeInTheDocument();
  expect(screen.queryByText("每月 1 堂")).not.toBeInTheDocument();
});

test("shows the monthly starter price in TWD", () => {
  render(
    <PlanCard
      plan={{
        id: "starter-1",
        code: "starter-monthly",
        billingType: "subscription",
        classCredits: 8,
        amountTwdCents: 288000,
      }}
      isAuthenticated={false}
    />,
  );

  expect(screen.getByText("NT$2,880／月")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /登入後選擇方案/i })).toHaveAttribute(
    "href",
    "/login?next=/plans",
  );
});
