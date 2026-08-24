import { render } from "@testing-library/react";
import React from "react";
import { describe, it, expect } from "vitest";

import { Wordmark } from "../../components/Wordmark";
import { APP_NAME_WORDMARK } from "../../lib/brand";
import { renderWithProviders } from "../testUtils";

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

  it("renders each wordmark syllable in its own element, in order", () => {
    const { container } = renderWithProviders(<Wordmark />);
    const [first, second] = APP_NAME_WORDMARK;
    const lockup = container.querySelector("span")!;
    const syllables = Array.from(lockup.querySelectorAll("span"))
      .map((el) => el.textContent)
      .filter((text) => text === first || text === second);
    expect(syllables).toEqual([first, second]);
    expect(lockup.textContent).toBe(APP_NAME_WORDMARK.join(""));
  });
});
