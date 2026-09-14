import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

import { middleware } from "./middleware";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-placeholder");
  getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
});
afterEach(() => vi.unstubAllEnvs());
it.each(["/account", "/account/bookings", "/account/orders"])(
  "preserves path after expired session: %s",
  async (path) => {
    const response = await middleware(
      new NextRequest(`http://localhost:3000${path}?next=https://evil.test`),
    );
    const location = new URL(response.headers.get("location") ?? "missing");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe(path);
    expect(location.origin).toBe("http://localhost:3000");
  },
);
it("does not redirect authenticated account access", async () => {
  getUser.mockResolvedValue({ data: { user: { id: "member" } } });
  expect(
    (
      await middleware(new NextRequest("http://localhost:3000/account"))
    ).headers.get("location"),
  ).toBeNull();
});
it("does not protect public pages", async () => {
  expect(
    (
      await middleware(new NextRequest("http://localhost:3000/classes"))
    ).headers.get("location"),
  ).toBeNull();
});
