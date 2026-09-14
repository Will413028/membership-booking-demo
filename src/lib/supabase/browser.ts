"use client";

import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { AuthError } from "../auth/types";

export type BrowserSupabaseClient = SupabaseClient;

export function createBrowserClient(): BrowserSupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new AuthError("CONFIGURATION_ERROR");
  }

  return createSupabaseBrowserClient(url, anonKey);
}
