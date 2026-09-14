export type PlanCode = "starter-monthly" | "unlimited-monthly" | "single-class";

export type Plan = {
  id: string;
  code: PlanCode;
  billingType: "subscription" | "one_time";
  classCredits: number | null;
  amountTwdCents: number;
};

export type Membership = {
  id: string;
  userId: string;
  status: "active" | "past_due" | "canceled" | "expired";
  creditsRemaining: number | null;
  currentPeriodEnd: string;
};

export type ClassSession = {
  id: string;
  classId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  active: boolean;
};

export type Booking = {
  id: string;
  userId: string;
  sessionId: string;
  membershipId: string;
  status: "confirmed" | "cancelled";
  createdAt: string;
  cancelledAt: string | null;
};

export type OrderStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

export type Order = {
  id: string;
  userId: string;
  status: OrderStatus;
  amountTwdCents: number;
  currency: "twd";
  stripeCheckoutSessionId: string | null;
};
