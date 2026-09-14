import { render, screen } from "@testing-library/react";
import { beforeEach, vi } from "vitest";

import { AuthError } from "@/lib/auth/types";

const { getOrderStatus } = vi.hoisted(() => ({ getOrderStatus: vi.fn() }));

vi.mock("@/features/orders/queries", () => ({ getOrderStatus }));

import CheckoutSuccessPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  window.history.pushState({}, "", "/checkout/success?order_id=order-1");
});

test("shows CONFIGURATION_ERROR when the order status cannot read required config", async () => {
  getOrderStatus.mockRejectedValue(new AuthError("CONFIGURATION_ERROR"));
  render(<CheckoutSuccessPage />);

  expect(
    await screen.findByRole("heading", { name: "CONFIGURATION_ERROR" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "Checkout configuration is incomplete. No payment was processed.",
    ),
  ).toBeInTheDocument();
});
