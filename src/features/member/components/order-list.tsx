import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import type { MemberOrder } from "./member-summary-card";

function money(value: number) {
  return `NT$${new Intl.NumberFormat("zh-TW").format(value / 100)}`;
}
const statusLabel: Record<MemberOrder["status"], string> = {
  pending: "處理中",
  paid: "已付款",
  failed: "付款失敗",
  cancelled: "已取消",
  refunded: "已退款",
};

export function OrderList({ orders }: { orders: MemberOrder[] }) {
  if (!orders.length)
    return (
      <Card>
        <h2 className="font-display text-2xl font-bold">尚無訂單</h2>
        <p className="mt-2 text-muted-foreground">你的方案訂單會顯示在這裡。</p>
      </Card>
    );
  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <Card
          key={order.id}
          className="flex items-center justify-between gap-4"
        >
          <div>
            <p className="font-semibold">{order.planName}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {money(order.amountTwdCents)}
            </p>
          </div>
          <Badge>{statusLabel[order.status]}</Badge>
        </Card>
      ))}
    </div>
  );
}
