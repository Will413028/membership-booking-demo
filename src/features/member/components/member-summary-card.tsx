import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export type MemberBooking = {
  id: string;
  className: string;
  instructorName: string;
  startsAt: string;
  status: "confirmed" | "cancelled";
};
export type MemberOrder = {
  id: string;
  planName: string;
  amountTwdCents: number;
  status: "pending" | "paid" | "failed" | "cancelled" | "refunded";
  createdAt: string;
};
export type MemberDashboardData = {
  membership: {
    name: string;
    status: string;
    creditsRemaining: number | null;
    currentPeriodEnd: string;
  } | null;
  nextBooking: MemberBooking | null;
  recentOrders: MemberOrder[];
};

function date(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function MemberSummaryCard({ data }: { data: MemberDashboardData }) {
  if (!data.membership)
    return (
      <Card>
        <p className="text-sm font-semibold text-coral">尚未啟用方案</p>
        <h2 className="mt-2 font-display text-3xl font-bold">
          開始你的練習節奏
        </h2>
        <p className="mt-3 text-muted-foreground">
          選擇適合你的方案後，即可預約下一堂課。
        </p>
        <Link
          className="mt-6 inline-flex rounded-full bg-ink px-5 py-3 font-semibold text-paper"
          href="/plans"
        >
          查看方案
        </Link>
      </Card>
    );
  const credits =
    data.membership.creditsRemaining === null
      ? "不限堂數"
      : `${data.membership.creditsRemaining} 堂剩餘`;
  return (
    <Card className="bg-ink text-paper">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-paper/70">目前方案</p>
          <h2 className="mt-1 font-display text-3xl font-bold">
            {data.membership.name}
          </h2>
        </div>
        <Badge className="bg-coral text-ink">{data.membership.status}</Badge>
      </div>
      <p className="mt-8 font-display text-4xl font-bold">{credits}</p>
      <p className="mt-2 text-sm text-paper/70">
        有效至 {date(data.membership.currentPeriodEnd)}
      </p>
      {data.nextBooking ? (
        <div className="mt-7 border-t border-paper/20 pt-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-paper/70">
            下一堂課
          </p>
          <p className="mt-2 font-semibold">
            {data.nextBooking.className} · {date(data.nextBooking.startsAt)}
          </p>
        </div>
      ) : (
        <p className="mt-7 border-t border-paper/20 pt-5 text-sm text-paper/70">
          尚無下一堂預約。
        </p>
      )}
      <Link
        className="mt-6 inline-flex rounded-full bg-paper px-4 py-2 text-sm font-semibold text-ink"
        href="/classes"
      >
        預約課程
      </Link>
    </Card>
  );
}
