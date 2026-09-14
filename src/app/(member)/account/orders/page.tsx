import type { MemberOrder } from "@/features/member/components/member-summary-card";
import { OrderList } from "@/features/member/components/order-list";
import { requireUser } from "@/lib/auth/guards";
import { createServerClient } from "@/lib/supabase/server";

export default async function OrdersPage() {
  const supabase = await createServerClient();
  const user = await requireUser(supabase);
  const { data } = await supabase
    .from("orders")
    .select(
      "id, status, amount_twd_cents, created_at, order_items(plans(name))",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const orders = (
    (data ?? []) as Array<{
      id: string;
      status: MemberOrder["status"];
      amount_twd_cents: number;
      created_at: string;
      order_items: Array<{ plans: { name: string } | Array<{ name: string }> }>;
    }>
  ).map((order): MemberOrder => {
    const plans = order.order_items[0]?.plans;
    const plan = Array.isArray(plans) ? plans[0] : plans;
    return {
      id: order.id,
      status: order.status,
      amountTwdCents: order.amount_twd_cents,
      createdAt: order.created_at,
      planName: plan?.name ?? "會員方案",
    };
  });
  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-coral">
        Orders
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold">訂單紀錄</h1>
      <p className="mt-3 text-muted-foreground">
        付款與 webhook 處理狀態會顯示在這裡。
      </p>
      <div className="mt-8">
        <OrderList orders={orders} />
      </div>
    </section>
  );
}
