import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { AtmosphereLinks } from "../../components/profile/AtmosphereLinks";
import { withMarks, type AtmosphereAppLink } from "../../lib/atmosphereApps";
import { en } from "../../lib/i18n/en";
import { renderWithProviders } from "../testUtils";

const HANDLE = "alice.bsky.social";

/** Catalog ids, so the marks are the ones a reader actually gets. */
const CATALOG_IDS = ["tangled", "leaflet", "grain", "semble", "streamplace"] as const;

function link(id: string, name: string): AtmosphereAppLink {
  return { id, name, url: `https://${id}.example/${HANDLE}` };
}

function appsFor(count: number) {
  return withMarks(CATALOG_IDS.slice(0, count).map((id) => link(id, id)));
}

describe("AtmosphereLinks", () => {
  it("renders nothing at all for an account on no other apps", () => {
    // The URL bar it sits in must look exactly as it did before, no reserved gap.
    renderWithProviders(<AtmosphereLinks apps={[]} />);

    expect(screen.queryByLabelText(en.profileUrlBar.atmosphereLinksLabel)).not.toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("links each app the account is on", () => {
    renderWithProviders(<AtmosphereLinks apps={withMarks([link("tangled", "Tangled")])} />);

    expect(screen.getByRole("link", { name: en.profileCard.viewOn("Tangled") })).toHaveAttribute(
      "href",
      `https://tangled.example/${HANDLE}`
    );
  });

  it("opens an app in a new tab without leaking the referrer", () => {
    renderWithProviders(<AtmosphereLinks apps={withMarks([link("tangled", "Tangled")])} />);

    const anchor = screen.getByRole("link", { name: en.profileCard.viewOn("Tangled") });
    expect(anchor).toHaveAttribute("target", "_blank");
    expect(anchor).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows an app the catalog has no mark for", () => {
    // Rocksky comes from the server's supplementary table and has no brand mark,
    // so it falls back to a neutral one rather than rendering an empty box.
    renderWithProviders(<AtmosphereLinks apps={withMarks([link("rocksky", "Rocksky")])} />);

    expect(
      screen.getByRole("link", { name: en.profileCard.viewOn("Rocksky") })
    ).toBeInTheDocument();
  });

  it("names each app for the width that can read a name", () => {
    renderWithProviders(<AtmosphereLinks apps={withMarks([link("tangled", "Tangled")])} />);

    expect(screen.getByText("Tangled")).toBeInTheDocument();
  });

  it("carries the mark alongside the name, for the width that cannot", () => {
    // Both ship every time and CSS picks one, so the swap costs no JavaScript
    // and cannot flash on a page this public.
    const { container } = renderWithProviders(
      <AtmosphereLinks apps={withMarks([link("tangled", "Tangled")])} />
    );

    expect(container.querySelector(".ds-atmosphere-mark")).toBeInTheDocument();
  });

  it("shows four apps inline without an overflow menu", () => {
    renderWithProviders(<AtmosphereLinks apps={appsFor(4)} />);

    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: /more apps/i })).not.toBeInTheDocument();
  });

  it("moves the fifth app into an overflow menu rather than widening the row", () => {
    renderWithProviders(<AtmosphereLinks apps={appsFor(5)} />);

    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(
      screen.getByRole("button", { name: en.profileUrlBar.moreAtmosphereApps(1) })
    ).toBeInTheDocument();
  });

  it("reaches the overflowed app from inside the menu", async () => {
    renderWithProviders(<AtmosphereLinks apps={appsFor(5)} />);

    fireEvent.click(screen.getByRole("button", { name: en.profileUrlBar.moreAtmosphereApps(1) }));

    expect(await screen.findByRole("menuitem", { name: /streamplace/i })).toHaveAttribute(
      "href",
      `https://streamplace.example/${HANDLE}`
    );
  });

  it("names the row for a screen reader", () => {
    renderWithProviders(<AtmosphereLinks apps={withMarks([link("tangled", "Tangled")])} />);

    expect(screen.getByLabelText(en.profileUrlBar.atmosphereLinksLabel)).toBeInTheDocument();
  });
});
