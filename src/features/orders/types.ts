import type { OrderStatus } from "@/lib/domain/types";

export type CheckoutActionResult =
  | { ok: true; orderId: string; checkoutUrl: string }
  | {
      ok: false;
      code: "INVALID_PLAN" | "CONFIGURATION_ERROR";
      message: string;
    };

export type OrderStatusView = {
  orderId: string;
  status: OrderStatus;
  membershipActive: boolean;
};
