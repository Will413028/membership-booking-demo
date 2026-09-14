"use server";

import { requireUser } from "@/lib/auth/guards";
import { createServerClient } from "@/lib/supabase/server";

import type { OrderStatusView } from "./types";

export async function getOrderStatus(
  orderId: string,
): Promise<OrderStatusView> {
  const supabase = await createServerClient();
  const user = await requireUser(supabase);
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (orderError || !order) {
    throw new Error("Order not found.");
  }

  const { data: item } = await supabase
    .from("order_items")
    .select("plan_id")
    .eq("order_id", order.id)
    .limit(1)
    .maybeSingle();
  const { data: membership } = item?.plan_id
    ? await supabase
        .from("memberships")
        .select("status, current_period_end")
        .eq("user_id", user.id)
        .eq("plan_id", item.plan_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  return {
    orderId: order.id,
    status: order.status,
    membershipActive:
      membership?.status === "active" &&
      new Date(membership.current_period_end).getTime() > Date.now(),
  };
}
