import { BookingList } from "@/features/member/components/booking-list";
import type { MemberBooking } from "@/features/member/components/member-summary-card";
import { requireAccountUser } from "@/lib/auth/account";
import { DataError } from "@/lib/errors/data";
import { createServerClient } from "@/lib/supabase/server";

export default async function BookingsPage() {
  const supabase = await createServerClient();
  const user = await requireAccountUser("/account/bookings", supabase);
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, status, class_sessions(starts_at, classes(name, instructor_name))",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new DataError();
  const bookings = (
    (data ?? []) as Array<{
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
    .map((booking): MemberBooking => {
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
  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-coral">
        Bookings
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold">我的預約</h1>
      <p className="mt-3 text-muted-foreground">
        取消尚未開始的課程，僅在原會員計費期間內退回堂數。
      </p>
      <div className="mt-8">
        <BookingList bookings={bookings} />
      </div>
    </section>
  );
}
