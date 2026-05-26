import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { renderWithProviders } from "../testUtils";
import { Wordmark } from "../../components/Wordmark";

describe("Wordmark", () => {
  it("renders without crashing", () => {
    const { container } = renderWithProviders(<Wordmark />);
    expect(container.firstChild).not.toBeNull();
  });

  it("includes the WinkMark SVG when showMark is true (default)", () => {
    const { container } = renderWithProviders(<Wordmark />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("does not include the WinkMark SVG when showMark is false", () => {
    const { container } = renderWithProviders(<Wordmark showMark={false} />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders the text 'navyfragen'", () => {
    const { container } = renderWithProviders(<Wordmark />);
    expect(container.textContent).toContain("navy");
    expect(container.textContent).toContain("fragen");
  });
});
