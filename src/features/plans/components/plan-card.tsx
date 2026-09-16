"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Plan } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

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
    plan.billingType === "one_time"
      ? `${plan.classCredits} 堂，付款後 30 天有效`
      : plan.classCredits === null
        ? "不限堂數"
        : `每月 ${plan.classCredits} 堂`;
  const featured = plan.code === "unlimited-monthly";
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
    <Card
      data-testid={`plan-${plan.code}`}
      className={cn(
        "group relative isolate flex h-full flex-col overflow-hidden border-border/90 p-6 transition duration-300 hover:-translate-y-1 hover:border-olive/45 hover:shadow-[0_26px_55px_-36px_hsl(var(--ink))]",
        featured &&
          "border-olive/60 bg-ink text-paper shadow-[0_28px_60px_-34px_hsl(var(--ink))] hover:border-olive hover:shadow-[0_34px_70px_-34px_hsl(var(--ink))]",
      )}
    >
      {featured ? (
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-20 size-56 rounded-full bg-sage/25 blur-3xl transition-opacity duration-300 group-hover:opacity-80"
        />
      ) : null}
      <div className="relative flex items-start justify-between gap-4">
        <p
          className={cn(
            "text-sm font-bold uppercase tracking-[0.16em] text-coral",
            featured && "text-sage",
          )}
        >
          {plan.billingType === "subscription" ? "月訂閱" : "單次體驗"}
        </p>
        {featured ? (
          <span className="rounded-full bg-sage px-3 py-1 text-xs font-bold tracking-wide text-ink">
            推薦方案
          </span>
        ) : null}
      </div>
      <h3
        className={cn(
          "relative mt-8 font-display text-3xl font-bold tracking-tight text-ink",
          featured && "text-paper",
        )}
      >
        {plan.code === "starter-monthly"
          ? "Starter 8"
          : plan.code === "unlimited-monthly"
            ? "Unlimited"
            : "Single Class"}
      </h3>
      <p
        className={cn(
          "relative mt-4 font-display text-4xl font-bold tracking-tight text-ink",
          featured && "text-paper",
        )}
      >
        {planPrice(plan)}
      </p>
      <p
        className={cn(
          "relative mt-3 text-muted-foreground",
          featured && "text-paper/70",
        )}
      >
        {creditSummary}
      </p>
      <div className="relative mt-auto pt-7">
        {isAuthenticated ? (
          <Button
            className={cn(
              "w-full",
              featured && "bg-sage text-ink hover:bg-paper",
            )}
            disabled={isPending}
            onClick={choosePlan}
          >
            {isPending ? "正在前往結帳…" : "選擇這個方案"}
          </Button>
        ) : (
          <Link
            className={cn(
              "inline-flex w-full items-center justify-center rounded-full bg-ink px-5 py-3 font-semibold text-paper transition hover:bg-olive focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral",
              featured && "bg-sage text-ink hover:bg-paper",
            )}
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
