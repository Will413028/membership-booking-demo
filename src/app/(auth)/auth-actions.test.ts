import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
    },
  })),
}));

import { login } from "./login/actions";
import { signup } from "./signup/actions";

const unsafeNextValues = [
  "/\\external.example",
  "/%5cexternal.example",
  "/%255cexternal.example",
  "/plans%0ASet-Cookie",
  "/plans%",
];

function credentials(next?: string) {
  const formData = new FormData();
  formData.set("email", "member@example.com");
  formData.set("password", "password-123");
  if (next !== undefined) formData.set("next", next);
  return formData;
}

beforeEach(() => {
  mocks.redirect.mockReset();
  mocks.signInWithPassword.mockResolvedValue({
    data: { session: {} },
    error: null,
  });
  mocks.signUp.mockResolvedValue({ data: { session: {} }, error: null });
});

describe("login", () => {
  test("redirects a successful login to a safe continuation path", async () => {
    await login(null, credentials("/plans"));

    expect(mocks.redirect).toHaveBeenCalledWith("/plans");
  });

  test("redirects a successful login without a continuation path to account", async () => {
    await login(null, credentials());

    expect(mocks.redirect).toHaveBeenCalledWith("/account");
  });

  test("rejects an external-looking continuation path after a successful login", async () => {
    await login(null, credentials("//external.example"));

    expect(mocks.redirect).toHaveBeenCalledWith("/account");
  });

  test.each(unsafeNextValues)(
    "rejects an unsafe continuation path after a successful login: %s",
    async (next) => {
      await login(null, credentials(next));

      expect(mocks.redirect).toHaveBeenCalledWith("/account");
    },
  );

  test("returns validation errors when FormData is the action-state payload", async () => {
    const formData = new FormData();
    formData.set("email", "not-an-email");
    formData.set("password", "short");

    await expect(login(null, formData)).resolves.toEqual({
      ok: false,
      fieldErrors: {
        email: ["Enter a valid email address."],
        password: ["Password must be at least 8 characters."],
      },
    });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("signup", () => {
  test("redirects a successful signup to a safe continuation path", async () => {
    await signup(null, credentials("/plans"));

    expect(mocks.redirect).toHaveBeenCalledWith("/plans");
  });

  test("redirects a successful signup without a continuation path to account", async () => {
    await signup(null, credentials());

    expect(mocks.redirect).toHaveBeenCalledWith("/account");
  });

  test("rejects an external-looking continuation path after a successful signup", async () => {
    await signup(null, credentials("//external.example"));

    expect(mocks.redirect).toHaveBeenCalledWith("/account");
  });

  test.each(unsafeNextValues)(
    "rejects an unsafe continuation path after a successful signup: %s",
    async (next) => {
      await signup(null, credentials(next));

      expect(mocks.redirect).toHaveBeenCalledWith("/account");
    },
  );
});
