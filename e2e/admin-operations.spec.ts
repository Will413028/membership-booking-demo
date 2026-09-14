import { expect } from "@playwright/test";

import { test } from "./fixtures";

test.describe("admin operations", () => {
  test("creates, edits, and deactivates a future class session", async ({
    adminPage,
  }) => {
    await adminPage.goto("/admin/schedules");
    await adminPage.getByRole("link", { name: "New session" }).click();

    const startsAt = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    await adminPage.locator("#startsAt").fill(toLocalDateTime(startsAt));
    await adminPage.locator("#endsAt").fill(toLocalDateTime(endsAt));
    await adminPage.locator("#capacity").fill("6");
    await adminPage.getByRole("button", { name: "Create session" }).click();

    const row = adminPage.getByRole("row").filter({ hasText: "Morning Flow Yoga" }).last();
    await expect(row).toContainText("Active");
    await row.getByRole("link", { name: "Edit" }).click();
    await adminPage.locator("#capacity").fill("7");
    await adminPage.getByRole("button", { name: "Save session" }).click();

    const updatedRow = adminPage.getByRole("row").filter({ hasText: "Morning Flow Yoga" }).last();
    await expect(updatedRow).toContainText("0 / 7");
    await updatedRow.getByRole("button", { name: "Deactivate" }).click();
    await expect(updatedRow).toContainText("Inactive");
  });
});

function toLocalDateTime(value: Date): string {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}
