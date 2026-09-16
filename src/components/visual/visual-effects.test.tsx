import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BlurFade } from "./blur-fade";
import { Spotlight } from "./spotlight";

describe("visual effects", () => {
  it("keeps Spotlight decorative and hidden from assistive technology", () => {
    render(<Spotlight />);

    expect(screen.getByTestId("spotlight-effect")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("keeps BlurFade content available while marking its effect", () => {
    render(
      <BlurFade className="test-fade">
        <p>預約下一堂課</p>
      </BlurFade>,
    );

    expect(screen.getByText("預約下一堂課")).toBeInTheDocument();
    expect(screen.getByTestId("blur-fade-effect")).toHaveAttribute(
      "data-visual-effect",
      "blur-fade",
    );
    expect(screen.getByTestId("blur-fade-effect")).toHaveClass("test-fade");
  });
});
