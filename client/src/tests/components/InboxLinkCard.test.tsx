import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InboxLinkCard } from "../../components/messages/InboxLinkCard";
import { en } from "../../lib/i18n/en";
import { renderWithProviders } from "../testUtils";

const SHARE_DATA = {
  title: "Send me anonymous messages!",
  text: "Send Karan anonymous messages!",
  url: "https://fragen.navy/karan.bsky.social",
};

function renderCard() {
  return renderWithProviders(
    <InboxLinkCard
      shortUrl="fragen.navy/karan.bsky.social"
      fullUrl={SHARE_DATA.url}
      handle="karan.bsky.social"
      shareData={SHARE_DATA}
    />
  );
}

describe("InboxLinkCard OG warm", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchSpy);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("warms the owner's OG card when the inbox link is copied", async () => {
    renderCard();

    await userEvent.click(screen.getByRole("button", { name: en.common.copy }));

    expect(fetchSpy).toHaveBeenCalledWith("/og-warm/karan.bsky.social", { method: "POST" });
  });

  it("warms the owner's OG card when the inbox link is shared", async () => {
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockResolvedValue(undefined),
      configurable: true,
      writable: true,
    });
    renderCard();

    await userEvent.click(screen.getByRole("button", { name: en.shareButton.button }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith("/og-warm/karan.bsky.social", { method: "POST" })
    );
  });

  it("does not warm when the share sheet was dismissed", async () => {
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError")),
      configurable: true,
      writable: true,
    });
    renderCard();

    await userEvent.click(screen.getByRole("button", { name: en.shareButton.button }));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps a failed warm out of the UI — the copy still reports success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("no OG service in front of the dev server"))
    );
    renderCard();

    await userEvent.click(screen.getByRole("button", { name: en.common.copy }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: en.common.copied })).toBeInTheDocument()
    );
    expect(screen.queryByText(/failed/i)).toBeNull();
  });
});
