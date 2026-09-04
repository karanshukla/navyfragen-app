import { notifications } from "@mantine/notifications";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { OpenInModal } from "../../components/messages/OpenInModal";
import { en } from "../../lib/i18n/en";
import { postWaypointTargetFor } from "../../lib/waypointTarget";
import { renderWithProviders } from "../testUtils";

const target = postWaypointTargetFor(
  "at://did:plc:abc123/app.bsky.feed.post/3k7qw",
  "alice.bsky.social"
)!;

const copy = en.openInPicker;

function renderModal(defaultClientId: string | null = null) {
  return renderWithProviders(
    <OpenInModal opened onClose={vi.fn()} target={target} defaultClientId={defaultClientId} />
  );
}

/** The section a client's row sits under, by that section's heading. */
function sectionFor(heading: string): HTMLElement {
  return screen.getByText(heading).parentElement!;
}

describe("OpenInModal client list", () => {
  it("leaves out a client that cannot render a Bluesky post", () => {
    renderModal();
    expect(screen.queryByRole("button", { name: copy.openInLabel("Tangled") })).toBeNull();
    expect(screen.getByRole("button", { name: copy.openInLabel("Bluesky") })).toBeInTheDocument();
  });
});

function setClipboard(writeText: (() => Promise<void>) | null) {
  Object.defineProperty(navigator, "clipboard", {
    value: writeText ? { writeText } : undefined,
    configurable: true,
    writable: true,
  });
}

function setShare(share: ((data: unknown) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, "share", { value: share, configurable: true, writable: true });
}

describe("OpenInModal", () => {
  beforeEach(() => {
    // The notification store is module-global, so a toast raised by one test is
    // still on screen for the next one unless it is cleared here.
    notifications.clean();
    setClipboard(() => Promise.resolve());
    setShare(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists a client the catalog resolves for the post", () => {
    renderModal();
    expect(screen.getByRole("button", { name: copy.openInLabel("Bluesky") })).toBeInTheDocument();
  });

  it("opens that client's own url for the post in a new tab", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderModal();

    await userEvent.click(screen.getByRole("button", { name: copy.openInLabel("Bluesky") }));

    expect(open).toHaveBeenCalledWith(
      "https://bsky.app/profile/alice.bsky.social/post/3k7qw",
      expect.anything(),
      expect.anything()
    );
  });

  it("files the chosen client under 'your default' rather than the catalog's own ranking", () => {
    renderModal("deer");
    const chosen = sectionFor(copy.yourDefaultHeading);
    expect(
      within(chosen).getByRole("button", { name: copy.openInLabel("Deer") })
    ).toBeInTheDocument();
  });

  it("leaves a client out of 'recommended' once it is the default", () => {
    renderModal("bluesky");
    const recommended = sectionFor(copy.recommendedHeading);
    expect(
      within(recommended).queryByRole("button", { name: copy.openInLabel("Bluesky") })
    ).not.toBeInTheDocument();
  });

  it("shows no 'your default' section when no client is chosen", () => {
    renderModal();
    expect(screen.queryByText(copy.yourDefaultHeading)).not.toBeInTheDocument();
  });

  it("confirms a copied client link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    renderModal();

    await userEvent.click(screen.getByRole("button", { name: copy.copyLinkLabel("Bluesky") }));

    expect(writeText).toHaveBeenCalledWith("https://bsky.app/profile/alice.bsky.social/post/3k7qw");
    expect(await screen.findByText(copy.linkCopied)).toBeInTheDocument();
  });

  it("reports a copy the browser refused", async () => {
    setClipboard(() => Promise.reject(new Error("denied")));
    renderModal();

    await userEvent.click(screen.getByRole("button", { name: copy.copyLinkLabel("Bluesky") }));

    expect(await screen.findByText(copy.copyFailed)).toBeInTheDocument();
  });

  describe("sharing a universal link", () => {
    const clickShare = async () =>
      userEvent.click(screen.getByRole("button", { name: copy.shareUniversalLink }));

    it("stays silent when the native sheet handled it", async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      setShare(share);
      renderModal();

      await clickShare();

      await waitFor(() => expect(share).toHaveBeenCalled());
      expect(screen.queryByText(copy.linkCopied)).not.toBeInTheDocument();
      expect(screen.queryByText(copy.shareFailed)).not.toBeInTheDocument();
    });

    it("stays silent when the user backed out of the native sheet", async () => {
      const abort = Object.assign(new Error("cancelled"), { name: "AbortError" });
      setShare(vi.fn().mockRejectedValue(abort));
      renderModal();

      await clickShare();

      await waitFor(() => expect(screen.queryByText(copy.linkCopied)).not.toBeInTheDocument());
      expect(screen.queryByText(copy.shareFailed)).not.toBeInTheDocument();
    });

    it("falls back to the clipboard where the browser has no share sheet", async () => {
      renderModal();

      await clickShare();

      expect(await screen.findByText(copy.linkCopied)).toBeInTheDocument();
    });

    it("reports a share the browser could neither send nor copy", async () => {
      setClipboard(null);
      renderModal();

      await clickShare();

      expect(await screen.findByText(copy.shareFailed)).toBeInTheDocument();
    });
  });
});
