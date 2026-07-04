import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { BounceLogosProvider, useBounceLogos } from "../../components/BounceLogosContext";

const STORAGE_KEY = "nf-bounce-logos-enabled";

function TestConsumer() {
  const { enabled, setEnabled } = useBounceLogos();
  return (
    <div>
      <span data-testid="state">{enabled ? "enabled" : "disabled"}</span>
      <button onClick={() => setEnabled(!enabled)}>toggle</button>
    </div>
  );
}

describe("BounceLogosProvider", () => {
  it("defaults to enabled when nothing is stored", () => {
    window.localStorage.removeItem(STORAGE_KEY);
    render(
      <BounceLogosProvider>
        <TestConsumer />
      </BounceLogosProvider>
    );
    expect(screen.getByTestId("state").textContent).toBe("enabled");
  });

  it("reads a previously stored disabled preference", () => {
    window.localStorage.setItem(STORAGE_KEY, "false");
    render(
      <BounceLogosProvider>
        <TestConsumer />
      </BounceLogosProvider>
    );
    expect(screen.getByTestId("state").textContent).toBe("disabled");
  });

  it("toggles and persists the new preference to localStorage", async () => {
    window.localStorage.removeItem(STORAGE_KEY);
    render(
      <BounceLogosProvider>
        <TestConsumer />
      </BounceLogosProvider>
    );

    await userEvent.click(screen.getByText("toggle"));

    expect(screen.getByTestId("state").textContent).toBe("disabled");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("false");
  });
});

describe("useBounceLogos", () => {
  it("throws when used outside a BounceLogosProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    function BadConsumer() {
      useBounceLogos();
      return null;
    }
    expect(() => render(<BadConsumer />)).toThrow(
      "useBounceLogos must be used within a BounceLogosProvider"
    );
    spy.mockRestore();
  });
});
