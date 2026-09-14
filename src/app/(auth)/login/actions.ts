"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { safeNext } from "@/lib/auth/safe-next";
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

  redirect(safeNext(formData.get("next")));
}
