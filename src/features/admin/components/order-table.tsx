import { Badge } from "@/components/ui/badge";
import { Table } from "@/components/ui/table";

import type { AdminOrder } from "../types";

export function OrderTable({ orders }: { orders: AdminOrder[] }) {
  if (!orders.length)
    return (
      <p className="rounded-2xl bg-paper p-6 text-muted-foreground">
        No orders match this search.
      </p>
    );
  return (
    <Table>
      <thead>
        <tr className="border-b border-border text-sm">
          <th className="p-3">Member</th>
          <th className="p-3">Plan</th>
          <th className="p-3">Amount</th>
          <th className="p-3">Status</th>
          <th className="p-3">Created</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr
            data-testid={`order-${order.id}`}
            className="border-b border-border last:border-0"
            key={order.id}
          >
            <td className="p-3 font-semibold">{order.memberName}</td>
            <td className="p-3">{order.planName}</td>
            <td className="p-3">
              NT${(order.amountTwdCents / 100).toLocaleString("zh-TW")}
            </td>
            <td className="p-3">
              <Badge>{order.status}</Badge>
            </td>
            <td className="p-3 text-sm">
              {new Intl.DateTimeFormat("zh-TW", {
                timeZone: "Asia/Taipei",
                dateStyle: "medium",
              }).format(new Date(order.createdAt))}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
