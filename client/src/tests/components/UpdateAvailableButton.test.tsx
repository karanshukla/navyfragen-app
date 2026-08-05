import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { renderWithProviders } from "../testUtils";

const triggerHaptic = vi.fn();
vi.mock("use-haptic", () => ({
  useHaptic: () => ({ triggerHaptic }),
}));

type SwUpdateModule = typeof import("../../lib/swUpdate");

let swUpdate: SwUpdateModule;
let UpdateAvailableButton: typeof import("../../components/UpdateAvailableButton").UpdateAvailableButton;

// swUpdate is module-level singleton state and the component reads it via
// useSyncExternalStore, so both are re-imported together for each test.
beforeEach(async () => {
  vi.resetModules();
  triggerHaptic.mockClear();
  swUpdate = await import("../../lib/swUpdate");
  ({ UpdateAvailableButton } = await import("../../components/UpdateAvailableButton"));
});

describe("UpdateAvailableButton", () => {
  it("renders nothing while no update is waiting", () => {
    renderWithProviders(<UpdateAvailableButton />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("appears once an update becomes ready", async () => {
    renderWithProviders(<UpdateAvailableButton />);

    swUpdate.markUpdateReady();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /update available/i })).toBeInTheDocument();
    });
  });

  it("renders immediately when an update was already ready before mount", () => {
    swUpdate.markUpdateReady();

    renderWithProviders(<UpdateAvailableButton />);

    expect(screen.getByRole("button", { name: /update available/i })).toBeInTheDocument();
  });

  it("applies the waiting update when pressed", async () => {
    const applier = vi.fn();
    swUpdate.setUpdateApplier(applier);
    swUpdate.markUpdateReady();
    renderWithProviders(<UpdateAvailableButton />);

    await userEvent.click(screen.getByRole("button", { name: /update available/i }));

    expect(applier).toHaveBeenCalledTimes(1);
  });

  it("fires haptic feedback when pressed", async () => {
    swUpdate.setUpdateApplier(vi.fn());
    swUpdate.markUpdateReady();
    renderWithProviders(<UpdateAvailableButton />);

    await userEvent.click(screen.getByRole("button", { name: /update available/i }));

    expect(triggerHaptic).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes from the store on unmount", () => {
    const { unmount } = renderWithProviders(<UpdateAvailableButton />);

    unmount();

    // A post-unmount notification must not attempt to update a torn-down tree.
    expect(() => swUpdate.markUpdateReady()).not.toThrow();
  });
});
