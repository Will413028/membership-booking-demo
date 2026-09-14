import { expect } from "@playwright/test";

import { test } from "./fixtures";

test.describe("member booking", () => {
  test("books and cancels a seeded future session with confirmed credit updates", async ({
    memberPage,
    e2e,
  }) => {
    await memberPage.goto(`/classes/${e2e.sessions.member.id}`);
    await expect(memberPage.getByText("剩餘 3 個名額")).toBeVisible();

    await memberPage.getByRole("button", { name: "預約這堂課" }).click();
    await expect(memberPage.getByText("預約已確認")).toBeVisible();

    await memberPage.goto("/account");
    await expect(memberPage.getByText("E2E Member Flow")).toBeVisible();
    await expect(memberPage.getByText("7 堂剩餘")).toBeVisible();

    await memberPage.getByRole("link", { name: "查看所有預約" }).click();
    await memberPage.getByRole("button", { name: "取消預約" }).click();
    await memberPage.getByRole("button", { name: "確認取消" }).click();
    await expect(memberPage.getByText("預約已取消，堂數已退回。")).toBeVisible();
    await expect(memberPage.getByText("已取消")).toBeVisible();

    await memberPage.goto("/account");
    await expect(memberPage.getByText("8 堂剩餘")).toBeVisible();
  });
});
