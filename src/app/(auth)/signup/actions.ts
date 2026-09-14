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

export async function signup(formData: FormData): Promise<AuthActionState> {
  const credentials = getCredentials(formData);

  if (!credentials.success) {
    return { ok: false, fieldErrors: credentials.error.flatten().fieldErrors };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signUp(credentials.data);

  if (error) {
    return {
      ok: false,
      fieldErrors: { form: ["Unable to create an account with that email."] },
    };
  }

  if (!data.session) {
    return {
      ok: false,
      fieldErrors: {
        form: ["Check your email to confirm your account, then sign in."],
      },
    };
  }

  redirect("/account");
}
