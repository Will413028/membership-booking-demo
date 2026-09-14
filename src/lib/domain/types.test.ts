import "./types";
import { describe, expect, it } from "vitest";

import type { Plan } from "./types";

describe("approved plan shapes", () => {
  it("represents finite, unlimited, and one-time credit semantics", () => {
    const plans: Plan[] = [
      {
        id: "starter",
        code: "starter-monthly",
        billingType: "subscription",
        classCredits: 8,
        amountTwdCents: 288000,
      },
      {
        id: "unlimited",
        code: "unlimited-monthly",
        billingType: "subscription",
        classCredits: null,
        amountTwdCents: 468000,
      },
      {
        id: "single",
        code: "single-class",
        billingType: "one_time",
        classCredits: 1,
        amountTwdCents: 68000,
      },
    ];

    expect(plans.map((plan) => plan.classCredits)).toEqual([8, null, 1]);
  });
});
