import { expect } from "@playwright/test";

import { test } from "./fixtures";
import { studioDateTime } from "../src/lib/time/studio";

test.describe("admin operations", () => {
  test("creates, edits, and deactivates a future class session", async ({
    adminPage,
  }) => {
    await adminPage.goto("/admin/schedules");
    await adminPage.getByRole("link", { name: "New session" }).click();

    await adminPage.locator("#classId").selectOption({ label: "Morning Flow Yoga · Mia Chen" });
    const startsAt = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    await adminPage.locator("#startsAt").fill(studioDateTime(startsAt.toISOString()));
    await adminPage.locator("#endsAt").fill(studioDateTime(endsAt.toISOString()));
    await adminPage.locator("#capacity").fill("6");
    await adminPage.getByRole("button", { name: "Create session" }).click();

    const row = adminPage.getByRole("row").filter({ hasText: "Morning Flow Yoga" }).last();
    await expect(row).toContainText("Active");
    await row.getByRole("link", { name: "Edit" }).click();
    await expect(adminPage.locator("#startsAt")).toHaveValue(studioDateTime(startsAt.toISOString()));
    await adminPage.locator("#capacity").fill("7");
    await adminPage.getByRole("button", { name: "Save session" }).click();

    const updatedRow = adminPage.getByRole("row").filter({ hasText: "Morning Flow Yoga" }).last();
    await expect(updatedRow).toContainText("0 / 7");
    await updatedRow.getByRole("button", { name: "Deactivate" }).click();
    await expect(updatedRow).toContainText("Inactive");
  });
});
