import type { CancelBookingResult } from "@/features/bookings/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code:
        | "UNAUTHORIZED"
        | "FORBIDDEN"
        | "VALIDATION_ERROR"
        | "DATABASE_ERROR";
      fieldErrors?: Record<string, string>;
    };

export type Session = {
  id: string;
  classId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  active: boolean;
  instructorName: string;
};

export type CreateSessionInput = Omit<Session, "id" | "active">;
export type UpdateSessionInput = CreateSessionInput & { id: string };

export type AdminClass = {
  id: string;
  name: string;
  instructorName: string;
  active: boolean;
};

export type AdminSchedule = Session & {
  className: string;
  category: string;
  confirmedCount: number;
};

export type AdminDashboardData = {
  revenueTwdCents: number;
  activeMemberCount: number;
  todayBookingCount: number;
  capacitySummary: Array<{
    date: string;
    confirmedCount: number;
    capacity: number;
  }>;
  nextSessions: AdminSchedule[];
};

export type AdminBooking = {
  id: string;
  status: "confirmed" | "cancelled";
  createdAt: string;
  cancelledAt: string | null;
  memberName: string;
  memberEmail: string | null;
  className: string;
  startsAt: string;
};

export type AdminMember = {
  id: string;
  fullName: string;
  email: string | null;
  membershipStatus: string | null;
  creditsRemaining: number | null;
  currentPeriodEnd: string | null;
};

export type AdminOrder = {
  id: string;
  status: "pending" | "paid" | "failed" | "cancelled" | "refunded";
  amountTwdCents: number;
  createdAt: string;
  memberName: string;
  planName: string;
};

export type AdminCancelBookingResult =
  | CancelBookingResult
  | { ok: false; code: "FORBIDDEN"; message: string };

export type { CancelBookingResult };
