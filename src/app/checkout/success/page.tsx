"use client";

import { useEffect, useState } from "react";

import { getOrderStatus } from "@/features/orders/queries";
import type { OrderStatusView } from "@/features/orders/types";

const MAX_POLLS = 20;
const POLL_INTERVAL_MS = 1_500;

export default function CheckoutSuccessPage() {
  const [order, setOrder] = useState<OrderStatusView | null>(null);
  const [state, setState] = useState<"processing" | "complete" | "unavailable">(
    "processing",
  );

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get("order_id");
    if (!orderId) {
      setState("unavailable");
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const nextOrder = await getOrderStatus(orderId);
        if (cancelled) {
          return;
        }

        setOrder(nextOrder);
        if (nextOrder.status === "paid" && nextOrder.membershipActive) {
          setState("complete");
          return;
        }
      } catch {
        if (!cancelled) {
          setState("unavailable");
        }
        return;
      }

      attempts += 1;
      if (attempts < MAX_POLLS && !cancelled) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  if (state === "complete") {
    return (
      <main>
        <h1>Payment confirmed</h1>
        <p>Your membership is active.</p>
        <a href="/account">Go to your account</a>
      </main>
    );
  }

  if (state === "unavailable") {
    return (
      <main>
        <h1>We could not confirm this payment</h1>
        <p>Please return to your account or try again later.</p>
        <a href="/account">Go to your account</a>
      </main>
    );
  }

  return (
    <main>
      <h1>Payment processing</h1>
      <p>
        {order
          ? `Order status: ${order.status}. We are waiting for Stripe to confirm your membership.`
          : "We are waiting for Stripe to confirm your payment."}
      </p>
    </main>
  );
}
