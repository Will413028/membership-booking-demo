"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Plan } from "@/lib/domain/types";

type CheckoutAction = (input: { planId: string }) => Promise<
  | { ok: true; orderId: string; checkoutUrl: string }
  | {
      ok: false;
      code: "INVALID_PLAN" | "CONFIGURATION_ERROR";
      message: string;
      recovery?: "ORDER_RETAINED";
    }
>;

function planPrice(plan: Plan) {
  const amount = new Intl.NumberFormat("zh-TW").format(
    plan.amountTwdCents / 100,
  );
  return `NT$${amount}${plan.billingType === "subscription" ? "／月" : "／堂"}`;
}

export function PlanCard({
  plan,
  isAuthenticated,
  startCheckoutAction,
}: {
  plan: Plan;
  isAuthenticated: boolean;
  startCheckoutAction?: CheckoutAction;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const creditSummary =
    plan.classCredits === null ? "不限堂數" : `每月 ${plan.classCredits} 堂`;
  const choosePlan = () =>
    startTransition(async () => {
      setError(null);
      if (!startCheckoutAction) {
        setError("結帳暫時無法使用，請稍後再試。");
        return;
      }
      try {
        const result = await startCheckoutAction({ planId: plan.id });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        window.location.assign(result.checkoutUrl);
      } catch {
        setError("請先登入後再選擇方案。");
      }
    });
  return (
    <Card className="flex h-full flex-col">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-coral">
        {plan.billingType === "subscription" ? "月訂閱" : "單次體驗"}
      </p>
      <h3 className="mt-3 font-display text-3xl font-bold">
        {plan.code === "starter-monthly"
          ? "Starter 8"
          : plan.code === "unlimited-monthly"
            ? "Unlimited"
            : "Single Class"}
      </h3>
      <p className="mt-4 font-display text-4xl font-bold">{planPrice(plan)}</p>
      <p className="mt-3 text-muted-foreground">{creditSummary}</p>
      <div className="mt-auto pt-7">
        {isAuthenticated ? (
          <Button className="w-full" disabled={isPending} onClick={choosePlan}>
            {isPending ? "正在前往結帳…" : "選擇這個方案"}
          </Button>
        ) : (
          <Link
            className="inline-flex w-full items-center justify-center rounded-full bg-ink px-5 py-3 font-semibold text-paper hover:bg-olive focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
            href="/login?next=/plans"
          >
            登入後選擇方案
          </Link>
        )}
        {error ? (
          <p aria-live="polite" className="mt-3 text-sm text-coral">
            {error}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
