import { requireAdmin } from "@/lib/auth/guards";
import { createServerClient } from "@/lib/supabase/server";
import { studioDateTime, studioInstant } from "@/lib/time/studio";

import type {
  AdminBooking,
  AdminClass,
  AdminDashboardData,
  AdminMember,
  AdminOrder,
  AdminSchedule,
  Session,
} from "./types";

type ClassRecord = {
  id: string;
  name: string;
  category: string;
  instructor_name: string;
  active: boolean;
};

type SessionRecord = {
  id: string;
  class_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  active: boolean;
  classes: ClassRecord | ClassRecord[] | null;
  bookings?: Array<{ count: number }>;
};

export class AdminDataError extends Error {
  constructor() {
    super("Unable to load admin data.");
    this.name = "AdminDataError";
  }
}

function throwAdminDataError(): never {
  throw new AdminDataError();
}

function related<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function toSchedule(
  row: SessionRecord,
  confirmedCount = row.bookings?.[0]?.count ?? 0,
): AdminSchedule | null {
  const classRecord = related(row.classes);
  if (!classRecord) return null;
  return {
    id: row.id,
    classId: row.class_id,
    className: classRecord.name,
    category: classRecord.category,
    instructorName: classRecord.instructor_name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    capacity: row.capacity,
    active: row.active,
    confirmedCount,
  };
}

function dayStart(value: Date): Date {
  return new Date(
    studioInstant(`${studioDateTime(value.toISOString()).slice(0, 10)}T00:00`),
  );
}

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const supabase = await createServerClient();
  await requireAdmin(supabase);

  const start = dayStart(new Date());
  const sevenDaysLater = new Date(start);
  sevenDaysLater.setUTCDate(sevenDaysLater.getUTCDate() + 7);
  const tomorrow = new Date(start);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const [ordersResult, membersResult, bookingsResult, sessionsResult] =
    await Promise.all([
      supabase.from("orders").select("amount_twd_cents").eq("status", "paid"),
      supabase.from("memberships").select("user_id").eq("status", "active"),
      supabase
        .from("bookings")
        .select("id, session_id, status, class_sessions(starts_at)")
        .eq("status", "confirmed"),
      supabase
        .from("class_sessions")
        .select(
          "id, class_id, starts_at, ends_at, capacity, active, classes!inner(id, name, category, instructor_name, active)",
        )
        .gte("starts_at", start.toISOString())
        .lt("starts_at", sevenDaysLater.toISOString())
        .order("starts_at", { ascending: true }),
    ]);
  if (
    ordersResult.error ||
    membersResult.error ||
    bookingsResult.error ||
    sessionsResult.error
  ) {
    throwAdminDataError();
  }

  const confirmedBySession = new Map<string, number>();
  let todayBookingCount = 0;
  for (const booking of (bookingsResult.data ?? []) as Array<{
    session_id: string;
    class_sessions: { starts_at: string } | Array<{ starts_at: string }> | null;
  }>) {
    confirmedBySession.set(
      booking.session_id,
      (confirmedBySession.get(booking.session_id) ?? 0) + 1,
    );
    const session = related(booking.class_sessions);
    if (
      session &&
      session.starts_at >= start.toISOString() &&
      session.starts_at < tomorrow.toISOString()
    ) {
      todayBookingCount += 1;
    }
  }

  const schedules = ((sessionsResult.data ?? []) as SessionRecord[])
    .map((session) =>
      toSchedule(session, confirmedBySession.get(session.id) ?? 0),
    )
    .filter((session): session is AdminSchedule => session !== null);
  const capacitySummary = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + 1);
    const sessions = schedules.filter(
      (session) =>
        session.startsAt >= date.toISOString() &&
        session.startsAt < next.toISOString(),
    );
    return {
      date: date.toISOString(),
      confirmedCount: sessions.reduce(
        (total, session) => total + session.confirmedCount,
        0,
      ),
      capacity: sessions.reduce(
        (total, session) => total + session.capacity,
        0,
      ),
    };
  });

  return {
    revenueTwdCents: (
      (ordersResult.data ?? []) as Array<{ amount_twd_cents: number }>
    ).reduce((total, order) => total + order.amount_twd_cents, 0),
    activeMemberCount: new Set(
      ((membersResult.data ?? []) as Array<{ user_id: string }>).map(
        (membership) => membership.user_id,
      ),
    ).size,
    todayBookingCount,
    capacitySummary,
    nextSessions: schedules.slice(0, 10),
  };
}

export async function listAdminClasses(options: {
  mode: "new" | "edit";
  includeInactiveClassId?: string;
}): Promise<AdminClass[]> {
  const supabase = await createServerClient();
  await requireAdmin(supabase);
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, instructor_name, active")
    .order("name", { ascending: true });
  if (error) throwAdminDataError();
  return (
    (data ?? []) as Array<
      Omit<AdminClass, "instructorName"> & { instructor_name: string }
    >
  )
    .filter(
      (classRecord) =>
        classRecord.active ||
        (options.mode === "edit" &&
          classRecord.id === options.includeInactiveClassId),
    )
    .map((classRecord) => ({
      id: classRecord.id,
      name: classRecord.name,
      instructorName: classRecord.instructor_name,
      active: classRecord.active,
    }));
}

export async function listAdminSchedules(
  filters: { active?: "active" | "inactive"; search?: string } = {},
): Promise<AdminSchedule[]> {
  const supabase = await createServerClient();
  await requireAdmin(supabase);
  let query = supabase
    .from("class_sessions")
    .select(
      "id, class_id, starts_at, ends_at, capacity, active, classes!inner(id, name, category, instructor_name, active), bookings(count)",
    )
    .eq("bookings.status", "confirmed")
    .order("starts_at", { ascending: true });
  if (filters.active) query = query.eq("active", filters.active === "active");

  const { data, error } = await query;
  if (error) throwAdminDataError();
  const search = filters.search?.trim().toLocaleLowerCase();
  return ((data ?? []) as SessionRecord[])
    .map((session) => toSchedule(session))
    .filter((session): session is AdminSchedule => {
      if (!session) return false;
      return (
        !search ||
        [session.className, session.instructorName, session.category].some(
          (value) => value.toLocaleLowerCase().includes(search),
        )
      );
    });
}

export async function getAdminSession(
  sessionId: string,
): Promise<Session | null> {
  const supabase = await createServerClient();
  await requireAdmin(supabase);
  const { data, error } = await supabase
    .from("class_sessions")
    .select(
      "id, class_id, starts_at, ends_at, capacity, active, classes!inner(id, name, category, instructor_name, active)",
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throwAdminDataError();
  if (!data) return null;
  const schedule = toSchedule(data as SessionRecord);
  if (!schedule) throwAdminDataError();
  const {
    className: _className,
    category: _category,
    confirmedCount: _confirmedCount,
    ...session
  } = schedule;
  return session;
}

export async function listAdminBookings(
  search?: string,
): Promise<AdminBooking[]> {
  const supabase = await createServerClient();
  await requireAdmin(supabase);
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, status, created_at, cancelled_at, profiles!inner(full_name), class_sessions!inner(starts_at, classes!inner(name))",
    )
    .order("created_at", { ascending: false });
  if (error) throwAdminDataError();
  const keyword = search?.trim().toLocaleLowerCase();
  return (data ?? [])
    .map((row) => {
      const booking = row as {
        id: string;
        status: "confirmed" | "cancelled";
        created_at: string;
        cancelled_at: string | null;
        profiles: { full_name: string } | Array<{ full_name: string }> | null;
        class_sessions:
          | {
              starts_at: string;
              classes: { name: string } | Array<{ name: string }> | null;
            }
          | Array<{
              starts_at: string;
              classes: { name: string } | Array<{ name: string }> | null;
            }>
          | null;
      };
      const session = related(booking.class_sessions);
      const classRecord = related(session?.classes ?? null);
      return {
        id: booking.id,
        status: booking.status,
        createdAt: booking.created_at,
        cancelledAt: booking.cancelled_at,
        memberName: related(booking.profiles)?.full_name || "Member",
        memberEmail: null,
        className: classRecord?.name ?? "Class",
        startsAt: session?.starts_at ?? "",
      };
    })
    .filter(
      (booking) =>
        !keyword ||
        [booking.memberName, booking.className, booking.status].some((value) =>
          value.toLocaleLowerCase().includes(keyword),
        ),
    );
}

export async function listAdminMembers(
  search?: string,
): Promise<AdminMember[]> {
  const supabase = await createServerClient();
  await requireAdmin(supabase);
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, memberships(status, credits_remaining, current_period_end)",
    )
    .eq("role", "member")
    .order("created_at", { ascending: false });
  if (error) throwAdminDataError();
  const keyword = search?.trim().toLocaleLowerCase();
  return (data ?? [])
    .map((row) => {
      const member = row as {
        id: string;
        full_name: string;
        memberships: Array<{
          status: string;
          credits_remaining: number | null;
          current_period_end: string;
        }>;
      };
      const membership = member.memberships[0] ?? null;
      return {
        id: member.id,
        fullName: member.full_name || "Member",
        email: null,
        membershipStatus: membership?.status ?? null,
        creditsRemaining: membership?.credits_remaining ?? null,
        currentPeriodEnd: membership?.current_period_end ?? null,
      };
    })
    .filter(
      (member) =>
        !keyword || member.fullName.toLocaleLowerCase().includes(keyword),
    );
}

export async function listAdminOrders(search?: string): Promise<AdminOrder[]> {
  const supabase = await createServerClient();
  await requireAdmin(supabase);
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, status, amount_twd_cents, created_at, profiles!inner(full_name), order_items(plans(name))",
    )
    .order("created_at", { ascending: false });
  if (error) throwAdminDataError();
  const keyword = search?.trim().toLocaleLowerCase();
  return (data ?? [])
    .map((row) => {
      const order = row as {
        id: string;
        status: AdminOrder["status"];
        amount_twd_cents: number;
        created_at: string;
        profiles: { full_name: string } | Array<{ full_name: string }> | null;
        order_items: Array<{
          plans: { name: string } | Array<{ name: string }> | null;
        }>;
      };
      return {
        id: order.id,
        status: order.status,
        amountTwdCents: order.amount_twd_cents,
        createdAt: order.created_at,
        memberName: related(order.profiles)?.full_name || "Member",
        planName: related(order.order_items[0]?.plans ?? null)?.name ?? "Plan",
      };
    })
    .filter(
      (order) =>
        !keyword ||
        [order.memberName, order.planName, order.status].some((value) =>
          value.toLocaleLowerCase().includes(keyword),
        ),
    );
}
