import { describe, expect, it } from "vitest";

import type { ServerSupabaseClient } from "../supabase/server";
import { requireAdmin, requireUser } from "./guards";

type AuthUser = { id: string; email: string | null } | null;
type Profile = { role: "member" | "admin" } | null;

function createClient(user: AuthUser, profile: Profile): ServerSupabaseClient {
  return {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: profile, error: null }),
        }),
      }),
    }),
  } as unknown as ServerSupabaseClient;
}

describe("auth guards", () => {
  it("rejects an unauthenticated request before loading a profile", async () => {
    const mockUnauthenticatedClient = createClient(null, null);

    await expect(requireUser(mockUnauthenticatedClient)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects a member from an admin-only operation", async () => {
    const mockMemberClient = createClient(
      { id: "member-1", email: "member@example.com" },
      { role: "member" },
    );

    await expect(requireAdmin(mockMemberClient)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("returns an admin role loaded from the authenticated profile", async () => {
    const mockAdminClient = createClient(
      { id: "admin-1", email: "admin@example.com" },
      { role: "admin" },
    );

    await expect(requireAdmin(mockAdminClient)).resolves.toMatchObject({
      id: "admin-1",
      email: "admin@example.com",
      role: "admin",
    });
  });
});
