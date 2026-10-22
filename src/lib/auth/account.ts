import { redirect } from "next/navigation";
import { AuthError } from "@/lib/errors/auth";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { requireUser } from "./guards";

export async function requireAccountUser(
  path: "/account" | "/account/bookings" | "/account/orders",
  client?: ServerSupabaseClient,
) {
  try {
    return await requireUser(client);
  } catch (error) {
    if (error instanceof AuthError && error.code === "UNAUTHORIZED")
      redirect(`/login?next=${encodeURIComponent(path)}`);
    throw error;
  }
}
