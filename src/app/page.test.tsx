import { render, screen } from "@testing-library/react";
import HomePage from "./page";

test("renders the Motion Room booking call to action", () => {
  render(<HomePage />);
  expect(
    screen.getByRole("heading", { name: /make space for movement/i }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /book a class/i })).toHaveAttribute(
    "href",
    "/classes",
  );
  for (const link of screen.getAllByRole("link", { name: /探索會員方案/i })) {
    expect(link).toHaveAttribute("href", "/plans");
  }
  expect(screen.getByTestId("spotlight-effect")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});
