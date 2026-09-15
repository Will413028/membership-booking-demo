import { expect } from "@playwright/test";
import { test } from "./fixtures";

test("authenticated member fixture yields only after reaching the account pathname", async ({ memberPage }) => {
  expect(new URL(memberPage.url()).pathname).toBe("/account");
});
