import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import ShareButton from "../../components/ShareButton";
import { renderWithProviders } from "../testUtils";

describe("ShareButton", () => {
  const shareData = { title: "Test", url: "https://example.com" };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("when navigator.share is available", () => {
    beforeEach(() => {
      Object.defineProperty(navigator, "share", {
        value: vi.fn().mockResolvedValue(undefined),
        configurable: true,
        writable: true,
      });
    });

    it("calls onSuccess when share succeeds", async () => {
      const onSuccess = vi.fn();
      renderWithProviders(<ShareButton shareData={shareData} onSuccess={onSuccess} />);
      await userEvent.click(screen.getByText("Share"));
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it("does not call any callback when user aborts (AbortError)", async () => {
      const onSuccess = vi.fn();
      const onError = vi.fn();
      const abortError = new DOMException("User cancelled", "AbortError");
      Object.defineProperty(navigator, "share", {
        value: vi.fn().mockRejectedValue(abortError),
        configurable: true,
        writable: true,
      });
      renderWithProviders(
        <ShareButton shareData={shareData} onSuccess={onSuccess} onError={onError} />
      );
      await userEvent.click(screen.getByText("Share"));
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it("calls onError when share throws non-abort error", async () => {
      const onError = vi.fn();
      Object.defineProperty(navigator, "share", {
        value: vi.fn().mockRejectedValue(new Error("share failed")),
        configurable: true,
        writable: true,
      });
      renderWithProviders(<ShareButton shareData={shareData} onError={onError} />);
      await userEvent.click(screen.getByText("Share"));
      expect(onError).toHaveBeenCalledTimes(1);
    });
  });

  describe("when navigator.share is unavailable but clipboard is available", () => {
    beforeEach(() => {
      Object.defineProperty(navigator, "share", {
        value: undefined,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        configurable: true,
        writable: true,
      });
    });

    it("copies to clipboard and calls onSuccess", async () => {
      const onSuccess = vi.fn();
      renderWithProviders(<ShareButton shareData={shareData} onSuccess={onSuccess} />);
      await userEvent.click(screen.getByText("Share"));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://example.com");
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it("calls onError when clipboard write fails", async () => {
      const onError = vi.fn();
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
        configurable: true,
        writable: true,
      });
      renderWithProviders(<ShareButton shareData={shareData} onError={onError} />);
      await userEvent.click(screen.getByText("Share"));
      expect(onError).toHaveBeenCalledTimes(1);
    });
  });

  describe("when neither share nor clipboard is available", () => {
    beforeEach(() => {
      Object.defineProperty(navigator, "share", {
        value: undefined,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
        writable: true,
      });
    });

    it("shows unavailable notification", async () => {
      renderWithProviders(<ShareButton shareData={shareData} />);
      await userEvent.click(screen.getByText("Share"));
      expect(screen.getByText("Sharing unavailable")).toBeInTheDocument();
    });
  });

  describe("optional callbacks are omitted", () => {
    it("share succeeds with no onSuccess callback — no crash", async () => {
      Object.defineProperty(navigator, "share", {
        value: vi.fn().mockResolvedValue(undefined),
        configurable: true,
        writable: true,
      });
      // No onSuccess prop passed
      renderWithProviders(<ShareButton shareData={shareData} />);
      await userEvent.click(screen.getByText("Share"));
      expect(document.body).toBeInTheDocument();
    });

    it("share fails with non-abort error and no onError callback — no crash", async () => {
      Object.defineProperty(navigator, "share", {
        value: vi.fn().mockRejectedValue(new Error("share failed")),
        configurable: true,
        writable: true,
      });
      // No onError prop passed
      renderWithProviders(<ShareButton shareData={shareData} />);
      await userEvent.click(screen.getByText("Share"));
      expect(document.body).toBeInTheDocument();
    });

    it("clipboard copy succeeds with no onSuccess callback — no crash", async () => {
      Object.defineProperty(navigator, "share", {
        value: undefined,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        configurable: true,
        writable: true,
      });
      // No onSuccess prop passed
      renderWithProviders(<ShareButton shareData={shareData} />);
      await userEvent.click(screen.getByText("Share"));
      expect(document.body).toBeInTheDocument();
    });

    it("clipboard copy fails with no onError callback — no crash", async () => {
      Object.defineProperty(navigator, "share", {
        value: undefined,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
        configurable: true,
        writable: true,
      });
      // No onError prop passed
      renderWithProviders(<ShareButton shareData={shareData} />);
      await userEvent.click(screen.getByText("Share"));
      expect(document.body).toBeInTheDocument();
    });
  });
});
