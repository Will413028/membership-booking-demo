import { redirect } from "next/navigation";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { requireUser } from "./guards";
import { AuthError } from "./types";

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
