import { render } from "@testing-library/react";
import React from "react";
import { describe, it, expect } from "vitest";

import { WinkMark } from "../../components/WinkMark";

describe("WinkMark", () => {
  it("renders without crashing with default props", () => {
    const { container } = render(<WinkMark />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("applies the size prop to width and height attributes", () => {
    const { container } = render(<WinkMark size={64} />);
    const svg = container.querySelector("svg");
    expect(svg!.getAttribute("width")).toBe("64");
    expect(svg!.getAttribute("height")).toBe("64");
  });

  it("renders the sparkle path when sparkle is true (default)", () => {
    const { container } = render(<WinkMark sparkle />);
    // The sparkle path is the only path with 'L133' in its d attribute
    const paths = container.querySelectorAll("path");
    const sparklePath = Array.from(paths).find((p) => p.getAttribute("d")?.includes("L133"));
    expect(sparklePath).not.toBeUndefined();
  });

  it("does not render sparkle path when sparkle is false", () => {
    const { container } = render(<WinkMark sparkle={false} />);
    const paths = container.querySelectorAll("path");
    const sparklePath = Array.from(paths).find((p) => p.getAttribute("d")?.includes("L133"));
    expect(sparklePath).toBeUndefined();
  });

  it("sets role=img and aria-label when aria-hidden is not set", () => {
    const { container } = render(<WinkMark />);
    const svg = container.querySelector("svg");
    expect(svg!.getAttribute("role")).toBe("img");
    expect(svg!.getAttribute("aria-label")).toBe("Navyfragen");
  });

  it("omits role and aria-label when aria-hidden is true", () => {
    const { container } = render(<WinkMark aria-hidden />);
    const svg = container.querySelector("svg");
    expect(svg!.getAttribute("role")).toBeNull();
    expect(svg!.getAttribute("aria-label")).toBeNull();
    expect(svg!.getAttribute("aria-hidden")).toBe("true");
  });
});
