import { expect, type Page } from "@playwright/test";

import { test } from "./fixtures";

test.describe("negative paths", () => {
  test("does not allow a member to access the admin area", async ({ memberPage }) => {
    await memberPage.goto("/admin");
    await expect(memberPage).toHaveURL(/\/(?:login|account)(?:\?|$)/);
  });

  test("rejects a duplicate booking", async ({ memberPage, e2e }) => {
    await book(memberPage, e2e.sessions.duplicate.id);
    await book(memberPage, e2e.sessions.duplicate.id);
    await expect(memberPage.getByText("You already have a booking for this session.")).toBeVisible();
  });

  test("rejects a full session", async ({ memberPage, e2e }) => {
    await memberPage.goto(`/classes/${e2e.sessions.full.id}`);
    await expect(memberPage.getByText("本堂已額滿")).toBeVisible();
    await expect(memberPage.getByRole("button", { name: "本堂已額滿" })).toBeDisabled();
  });

  test("rejects a booking when the member has no credits", async ({
    memberPage,
    e2e,
  }) => {
    await e2e.setMemberCredits(0);
    await book(memberPage, e2e.sessions.insufficient.id);
    await expect(memberPage.getByText("You do not have enough class credits.")).toBeVisible();
  });

  test("keeps a cancelled checkout from activating membership", async ({ memberPage }) => {
    await memberPage.goto("/checkout/cancel");
    await expect(memberPage.getByRole("heading", { name: "Checkout cancelled" })).toBeVisible();
    await expect(memberPage.getByText("No membership has been activated.")).toBeVisible();
  });

  test("keeps the success page in processing until the webhook marks an order paid", async ({
    memberPage,
    e2e,
  }) => {
    await memberPage.goto(`/checkout/success?order_id=${e2e.pendingOrderId}`);
    await expect(memberPage.getByRole("heading", { name: "Payment processing" })).toBeVisible();
    await expect(memberPage.getByText("Order status: pending.")).toBeVisible();
    await expect(memberPage.getByText("Your membership is active.")).not.toBeVisible();
  });
});

async function book(
  page: Page,
  sessionId: string,
) {
  await page.goto(`/classes/${sessionId}`);
  await page.getByRole("button", { name: "預約這堂課" }).click();
}
