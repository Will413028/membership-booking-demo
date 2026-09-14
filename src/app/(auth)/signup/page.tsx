"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type AuthActionState, signup } from "./actions";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/account";
}

export default function SignupPage() {
  const next = safeNext(useSearchParams().get("next"));
  const [state, formAction, pending] = useActionState<
    AuthActionState | null,
    FormData
  >(async (_previous, formData) => signup(formData), null);
  return (
    <main className="auth-shell">
      <form
        action={formAction}
        className="w-full max-w-md rounded-3xl border border-border bg-paper p-7 shadow-sm"
      >
        <Link className="font-display text-xl font-bold" href="/">
          Motion Room
        </Link>
        <h1 className="mt-8 font-display text-4xl font-bold">開始你的練習</h1>
        <p className="mt-2 text-muted-foreground">
          建立帳號後，即可挑選方案與預約課程。
        </p>
        <input type="hidden" name="next" value={next} />
        <div className="mt-7 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              autoComplete="email"
              id="email"
              name="email"
              type="email"
              required
            />
            {state?.fieldErrors.email?.map((error) => (
              <p key={error} className="text-sm text-coral">
                {error}
              </p>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密碼</Label>
            <Input
              autoComplete="new-password"
              id="password"
              name="password"
              type="password"
              required
            />
            {state?.fieldErrors.password?.map((error) => (
              <p key={error} className="text-sm text-coral">
                {error}
              </p>
            ))}
          </div>
        </div>
        {state?.fieldErrors.form?.map((error) => (
          <p key={error} aria-live="polite" className="mt-4 text-sm text-coral">
            {error}
          </p>
        ))}
        <Button className="mt-7 w-full" disabled={pending} type="submit">
          {pending ? "建立中…" : "建立帳號"}
        </Button>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          已經有帳號？{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`}>登入</Link>
        </p>
      </form>
    </main>
  );
}
