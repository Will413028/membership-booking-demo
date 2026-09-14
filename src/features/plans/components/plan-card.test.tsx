import { render, screen } from "@testing-library/react";

import { PlanCard } from "./plan-card";

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
