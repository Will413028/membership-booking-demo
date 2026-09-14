import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { AuthError } from "@/lib/auth/types";

const { listUpcomingSessions } = vi.hoisted(() => ({
  listUpcomingSessions: vi.fn(),
}));

vi.mock("@/features/classes/queries", () => ({ listUpcomingSessions }));

import ClassesPage from "./page";

test("renders CONFIGURATION_ERROR when Supabase configuration is absent", async () => {
  listUpcomingSessions.mockRejectedValue(new AuthError("CONFIGURATION_ERROR"));

  render(await ClassesPage({ searchParams: Promise.resolve({}) }));

  expect(screen.getByText("CONFIGURATION_ERROR")).toBeInTheDocument();
});

test("keeps the generic message for a non-configuration class query failure", async () => {
  listUpcomingSessions.mockRejectedValue(new Error("database unavailable"));

  render(await ClassesPage({ searchParams: Promise.resolve({}) }));

  expect(screen.getByText("課表暫時無法載入")).toBeInTheDocument();
  expect(screen.queryByText("CONFIGURATION_ERROR")).not.toBeInTheDocument();
});
