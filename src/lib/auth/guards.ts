import {
  createServerClient,
  type ServerSupabaseClient,
} from "../supabase/server";
import type { AppRole, SessionUser } from "./types";
import { AuthError } from "./types";

function isAppRole(role: unknown): role is AppRole {
  return role === "member" || role === "admin";
}

export async function getCurrentUser(
  client?: ServerSupabaseClient,
): Promise<SessionUser | null> {
  const supabase = client ?? (await createServerClient());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !isAppRole(profile.role)) {
    return null;
  }

  return { id: user.id, email: user.email ?? null, role: profile.role };
}

export async function requireUser(
  client?: ServerSupabaseClient,
): Promise<SessionUser> {
  const user = await getCurrentUser(client);

  if (!user) {
    throw new AuthError("UNAUTHORIZED");
  }

  return user;
}

export async function requireAdmin(
  client?: ServerSupabaseClient,
): Promise<SessionUser> {
  const user = await requireUser(client);

  if (user.role !== "admin") {
    throw new AuthError("FORBIDDEN");
  }

  return user;
}
