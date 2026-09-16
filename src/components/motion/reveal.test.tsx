import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Reveal } from "./reveal";

describe("Reveal", () => {
  it("keeps content accessible while marking the animated surface", () => {
    render(
      <Reveal className="test-reveal">
        <p>預約你的下一堂課</p>
      </Reveal>,
    );

    expect(screen.getByText("預約你的下一堂課")).toBeInTheDocument();
    expect(screen.getByTestId("reveal-surface")).toHaveAttribute(
      "data-reveal",
      "true",
    );
    expect(screen.getByTestId("reveal-surface")).toHaveClass("test-reveal");
  });
});
