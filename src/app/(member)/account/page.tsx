import Link from "next/link";
import { BookingList } from "@/features/member/components/booking-list";
import {
  type MemberBooking,
  type MemberDashboardData,
  type MemberOrder,
  MemberSummaryCard,
} from "@/features/member/components/member-summary-card";
import { OrderList } from "@/features/member/components/order-list";
import { requireAccountUser } from "@/lib/auth/account";
import { DataError } from "@/lib/errors/data";
import { createServerClient } from "@/lib/supabase/server";

async function dashboardData(): Promise<
  MemberDashboardData & { bookings: MemberBooking[] }
> {
  const supabase = await createServerClient();
  const user = await requireAccountUser("/account", supabase);
  const [membershipResult, bookingsResult, ordersResult] = await Promise.all([
    supabase
      .from("memberships")
      .select("status, credits_remaining, current_period_end, plans(name)")
      .eq("user_id", user.id)
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select(
        "id, status, class_sessions!inner(starts_at, classes(name, instructor_name))",
      )
      .eq("user_id", user.id)
      .eq("status", "confirmed")
      .gt("class_sessions.starts_at", new Date().toISOString())
      .order("class_sessions(starts_at)", { ascending: true })
      .limit(8),
    supabase
      .from("orders")
      .select(
        "id, status, amount_twd_cents, created_at, order_items(plans(name))",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);
  if (membershipResult.error || bookingsResult.error || ordersResult.error)
    throw new DataError();
  const bookings = (
    (bookingsResult.data ?? []) as Array<{
      id: string;
      status: "confirmed" | "cancelled";
      class_sessions:
        | {
            starts_at: string;
            classes:
              | { name: string; instructor_name: string }
              | Array<{ name: string; instructor_name: string }>;
          }
        | Array<{
            starts_at: string;
            classes:
              | { name: string; instructor_name: string }
              | Array<{ name: string; instructor_name: string }>;
          }>;
    }>
  )
    .map((booking) => {
      const session = Array.isArray(booking.class_sessions)
        ? booking.class_sessions[0]
        : booking.class_sessions;
      const classes = Array.isArray(session?.classes)
        ? session?.classes[0]
        : session?.classes;
      return {
        id: booking.id,
        status: booking.status,
        startsAt: session?.starts_at ?? "",
        className: classes?.name ?? "課程",
        instructorName: classes?.instructor_name ?? "",
      };
    })
    .filter((booking) => booking.startsAt);
  const membershipRaw = membershipResult.data as {
    status: string;
    credits_remaining: number | null;
    current_period_end: string;
    plans: { name: string } | Array<{ name: string }>;
  } | null;
  const plan =
    membershipRaw &&
    (Array.isArray(membershipRaw.plans)
      ? membershipRaw.plans[0]
      : membershipRaw.plans);
  const orders = (
    (ordersResult.data ?? []) as Array<{
      id: string;
      status: MemberOrder["status"];
      amount_twd_cents: number;
      created_at: string;
      order_items: Array<{ plans: { name: string } | Array<{ name: string }> }>;
    }>
  ).map((order) => {
    const planValue = order.order_items[0]?.plans;
    const orderPlan = Array.isArray(planValue) ? planValue[0] : planValue;
    return {
      id: order.id,
      status: order.status,
      amountTwdCents: order.amount_twd_cents,
      createdAt: order.created_at,
      planName: orderPlan?.name ?? "會員方案",
    };
  });
  return {
    membership: membershipRaw
      ? {
          name: plan?.name ?? "會員方案",
          status: membershipRaw.status,
          creditsRemaining: membershipRaw.credits_remaining,
          currentPeriodEnd: membershipRaw.current_period_end,
        }
      : null,
    nextBooking:
      bookings.find((booking) => booking.status === "confirmed") ?? null,
    recentOrders: orders,
    bookings,
  };
}

export default async function AccountPage() {
  const data = await dashboardData();
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-coral">
            Member space
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold">
            你的練習，正在成形
          </h1>
        </div>
        <Link
          className="rounded-full bg-ink px-5 py-3 font-semibold text-paper"
          href="/classes"
        >
          預約課程
        </Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <MemberSummaryCard data={data} />
        <section
          aria-label="即將到來的預約"
          className="rounded-3xl bg-paper p-6"
        >
          <h2 className="font-display text-2xl font-bold">即將到來的預約</h2>
          <div className="mt-5">
            <BookingList
              bookings={data.bookings
                .filter((booking) => booking.status === "confirmed")
                .slice(0, 2)}
            />
          </div>
          <Link
            className="mt-5 inline-block text-sm font-bold"
            href="/account/bookings"
          >
            查看所有預約 →
          </Link>
        </section>
      </div>
      <section>
        <h2 className="font-display text-3xl font-bold">最近訂單</h2>
        <div className="mt-5">
          <OrderList orders={data.recentOrders} />
        </div>
      </section>
    </div>
  );
}
