import { beforeEach, expect, it, vi } from "vitest";

const { requireUser, redirect } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("./guards", () => ({ requireUser }));
vi.mock("next/navigation", () => ({ redirect }));

import { AuthError } from "@/lib/errors/auth";
import { requireAccountUser } from "./account";

beforeEach(() => {
  vi.clearAllMocks();
  redirect.mockImplementation(() => {
    throw new Error("redirected");
  });
});
it.each(["/account", "/account/bookings", "/account/orders"] as const)(
  "redirects expired access with safe next %s",
  async (path) => {
    requireUser.mockRejectedValue(new AuthError("UNAUTHORIZED"));
    await expect(requireAccountUser(path)).rejects.toThrow("redirected");
    expect(redirect).toHaveBeenCalledWith(
      `/login?next=${encodeURIComponent(path)}`,
    );
  },
);
it("does not hide profile outages as logged-out", async () => {
  requireUser.mockRejectedValue(new Error("Unable to load data."));
  await expect(requireAccountUser("/account")).rejects.toThrow(
    "Unable to load data.",
  );
  expect(redirect).not.toHaveBeenCalled();
});
