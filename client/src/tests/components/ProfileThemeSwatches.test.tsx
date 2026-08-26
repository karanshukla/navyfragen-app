import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ProfileThemeSwatches } from "../../components/customise/ProfileThemeSwatches";
import * as styles from "../../components/customise/ProfileThemeSwatches.styles";
import { renderWithProviders } from "../testUtils";

/** happy-dom drops `repeat()` from an inline style, so the rule is read from the source. */
function declaredColumns(): number {
  return Number(/repeat\((\d+)/.exec(String(styles.grid.gridTemplateColumns))?.[1]);
}

describe("ProfileThemeSwatches", () => {
  it("gives every preset a column, so the row never wraps past the prompt card's height", () => {
    renderWithProviders(<ProfileThemeSwatches value="royal" disabled={false} onPick={() => {}} />);
    expect(declaredColumns()).toBe(screen.getAllByRole("button").length);
  });

  it("previews a colour as a band, not as the image picker's card mockup", () => {
    renderWithProviders(<ProfileThemeSwatches value="royal" disabled={false} onPick={() => {}} />);
    const preview = screen.getByRole("button", { name: "Royal" }).firstChild as HTMLElement;
    expect(preview.style.aspectRatio.replace(/\s/g, "")).toBe("16/9");
  });
});
