import { render, screen } from "@testing-library/react";

import { AuthError } from "@/lib/auth/types";
import { isConfigurationError } from "@/lib/errors/configuration";

import { ConfigurationError } from "./configuration-error";

test("renders a safe visible configuration error without raw details", () => {
  render(<ConfigurationError />);

  expect(screen.getByText("CONFIGURATION_ERROR")).toBeInTheDocument();
  expect(
    screen.queryByText(/secret|service role|stripe_/i),
  ).not.toBeInTheDocument();
});

test("recognizes only known configuration errors", () => {
  expect(isConfigurationError(new AuthError("CONFIGURATION_ERROR"))).toBe(true);
  expect(isConfigurationError({ message: "CONFIGURATION_ERROR" })).toBe(true);
  expect(isConfigurationError(new Error("database password leaked"))).toBe(
    false,
  );
});
