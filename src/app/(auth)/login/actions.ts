"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";

export type AuthActionState = {
  ok: false;
  fieldErrors: {
    email?: string[];
    password?: string[];
    form?: string[];
  };
};

const credentialsSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

function getCredentials(formData: FormData) {
  return credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
}

function getSafeNext(formData: FormData): string {
  const next = formData.get("next");
  return typeof next === "string" &&
    next.startsWith("/") &&
    !next.startsWith("//")
    ? next
    : "/account";
}

export async function login(formData: FormData): Promise<AuthActionState> {
  const credentials = getCredentials(formData);

  if (!credentials.success) {
    return { ok: false, fieldErrors: credentials.error.flatten().fieldErrors };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(
    credentials.data,
  );

  if (error || !data.session) {
    return {
      ok: false,
      fieldErrors: { form: ["Unable to sign in with those credentials."] },
    };
  }

  redirect(getSafeNext(formData));
}
