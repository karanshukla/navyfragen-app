import { render, screen, act } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { InstallPromptProvider, useInstallPrompt } from "../../components/InstallPromptContext";

function TestConsumer() {
  const { installPrompt } = useInstallPrompt();
  return <div data-testid="prompt">{installPrompt ? "has-prompt" : "no-prompt"}</div>;
}

describe("InstallPromptProvider", () => {
  it("renders children", () => {
    render(
      <InstallPromptProvider>
        <span>child content</span>
      </InstallPromptProvider>
    );
    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("provides installPrompt as null initially", () => {
    render(
      <InstallPromptProvider>
        <TestConsumer />
      </InstallPromptProvider>
    );
    expect(screen.getByTestId("prompt").textContent).toBe("no-prompt");
  });

  it("sets installPrompt when beforeinstallprompt fires", () => {
    render(
      <InstallPromptProvider>
        <TestConsumer />
      </InstallPromptProvider>
    );

    const fakeEvent = { preventDefault: vi.fn() };
    act(() => {
      window.dispatchEvent(Object.assign(new Event("beforeinstallprompt"), fakeEvent));
    });

    expect(screen.getByTestId("prompt").textContent).toBe("has-prompt");
  });

  it("clears installPrompt when appinstalled fires", () => {
    render(
      <InstallPromptProvider>
        <TestConsumer />
      </InstallPromptProvider>
    );

    act(() => {
      window.dispatchEvent(
        Object.assign(new Event("beforeinstallprompt"), {
          preventDefault: vi.fn(),
        })
      );
    });
    expect(screen.getByTestId("prompt").textContent).toBe("has-prompt");

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(screen.getByTestId("prompt").textContent).toBe("no-prompt");
  });

  it("removes event listeners on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = render(
      <InstallPromptProvider>
        <span />
      </InstallPromptProvider>
    );

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("beforeinstallprompt", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("appinstalled", expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

describe("useInstallPrompt", () => {
  it("throws when used outside InstallPromptProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    function BadConsumer() {
      useInstallPrompt();
      return null;
    }
    expect(() => render(<BadConsumer />)).toThrow(
      "useInstallPrompt must be used within an InstallPromptProvider"
    );
    spy.mockRestore();
  });
});
