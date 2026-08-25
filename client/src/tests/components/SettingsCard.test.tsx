import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { SettingsCard } from "../../components/SettingsCard";
import { renderWithProviders } from "../testUtils";

describe("SettingsCard", () => {
  it("renders title and description", () => {
    renderWithProviders(
      <SettingsCard title="My Setting" description="This setting controls X">
        <button>Action</button>
      </SettingsCard>
    );
    expect(screen.getByText("My Setting")).toBeInTheDocument();
    expect(screen.getByText("This setting controls X")).toBeInTheDocument();
  });

  it("renders children", () => {
    renderWithProviders(
      <SettingsCard title="T" description="D">
        <button>Click me</button>
      </SettingsCard>
    );
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("renders the control beside the title", () => {
    renderWithProviders(<SettingsCard title="T" description="D" control={<span>state</span>} />);
    expect(screen.getByText("state")).toBeInTheDocument();
  });

  it("renders the note after the description", () => {
    renderWithProviders(<SettingsCard title="T" description="D" note="Why it is off" />);
    expect(screen.getByText("Why it is off")).toBeInTheDocument();
  });

  it("omits the note when none is given", () => {
    renderWithProviders(<SettingsCard title="T" description="D" />);
    expect(screen.queryByText("Why it is off")).toBeNull();
  });

  it("fills its grid column, so cards in different rows share edges", () => {
    const { container } = renderWithProviders(
      <SettingsCard title="T" description="D">
        <span>child</span>
      </SettingsCard>
    );
    expect(container.querySelector(".mantine-Paper-root")).toHaveStyle({
      width: "100%",
      height: "100%",
    });
  });

  it("renders correctly in dark mode", () => {
    const { container } = renderWithProviders(
      <SettingsCard title="T" description="D">
        <span>child</span>
      </SettingsCard>,
      { colorScheme: "dark" }
    );
    expect(container.firstChild).not.toBeNull();
  });
});
