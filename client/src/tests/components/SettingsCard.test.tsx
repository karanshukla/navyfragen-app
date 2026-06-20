import { screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect } from "vitest";

import { SettingsCard } from "../../components/SettingsCard";
import { renderWithProviders } from "../testUtils";

describe("SettingsCard", () => {
  it("renders title and description", () => {
    renderWithProviders(
      <SettingsCard title="My Setting" description="This setting controls X" isDark={false}>
        <button>Action</button>
      </SettingsCard>
    );
    expect(screen.getByText("My Setting")).toBeInTheDocument();
    expect(screen.getByText("This setting controls X")).toBeInTheDocument();
  });

  it("renders children", () => {
    renderWithProviders(
      <SettingsCard title="T" description="D" isDark={false}>
        <button>Click me</button>
      </SettingsCard>
    );
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("renders with isDark=true (different background)", () => {
    const { container } = renderWithProviders(
      <SettingsCard title="T" description="D" isDark>
        <span>child</span>
      </SettingsCard>
    );
    expect(container.firstChild).not.toBeNull();
  });
});
