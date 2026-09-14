import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { AuthError } from "@/lib/auth/types";

const { createServerClient } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerClient }));
vi.mock("@/features/plans/components/plan-grid", () => ({
  PlanGrid: () => null,
}));

import PlansPage from "./page";

test("renders CONFIGURATION_ERROR when Supabase configuration is absent", async () => {
  createServerClient.mockRejectedValue(new AuthError("CONFIGURATION_ERROR"));

  render(await PlansPage());

  expect(screen.getByText("CONFIGURATION_ERROR")).toBeInTheDocument();
});
