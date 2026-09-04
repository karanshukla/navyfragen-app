import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ProfileCard, type ProfileSummary } from "../../components/profile/ProfileCard";
import { renderWithProviders } from "../testUtils";

const PROFILE: ProfileSummary = {
  did: "did:plc:abc123",
  handle: "alice.bsky.social",
  displayName: "Alice",
};

function viewLink() {
  return screen.getByRole("link", { name: /view on/i });
}

describe("ProfileCard", () => {
  it("sends a viewer with no chosen client to Bluesky", () => {
    renderWithProviders(
      <ProfileCard profile={PROFILE} clientId={null} openProfilesInApp={false} />
    );
    expect(viewLink()).toHaveTextContent("View on Bluesky");
    expect(viewLink()).toHaveAttribute("href", "https://bsky.app/profile/alice.bsky.social");
  });

  it("sends a viewer to the client they picked on /customise", () => {
    renderWithProviders(
      <ProfileCard profile={PROFILE} clientId="deer" openProfilesInApp={false} />
    );
    expect(viewLink()).toHaveTextContent("View on Deer");
    expect(viewLink()).toHaveAttribute("href", "https://deer.social/profile/alice.bsky.social");
  });

  it("reaches a client that addresses a repo only by DID", () => {
    renderWithProviders(
      <ProfileCard profile={PROFILE} clientId="pdsls" openProfilesInApp={false} />
    );
    expect(viewLink()).toHaveAttribute("href", "https://pdsls.dev/at://did:plc:abc123");
  });

  it("offers no destination for a profile with no handle to address", () => {
    renderWithProviders(
      <ProfileCard profile={{ displayName: "Alice" }} clientId="deer" openProfilesInApp={false} />
    );
    expect(screen.queryByRole("link", { name: /view on/i })).not.toBeInTheDocument();
  });

  it("keeps a bio @mention inside the app when the viewer asked it to", () => {
    renderWithProviders(
      <ProfileCard
        profile={{ ...PROFILE, description: "hi from @bob.bsky.social" }}
        clientId="deer"
        openProfilesInApp
      />
    );
    expect(screen.getByRole("link", { name: "@bob.bsky.social" })).toHaveAttribute(
      "href",
      "/profile/bob.bsky.social"
    );
  });

  it("sends a bio @mention to the viewer's client when they did not", () => {
    renderWithProviders(
      <ProfileCard
        profile={{ ...PROFILE, description: "hi from @bob.bsky.social" }}
        clientId="deer"
        openProfilesInApp={false}
      />
    );
    expect(screen.getByRole("link", { name: "@bob.bsky.social" })).toHaveAttribute(
      "href",
      "https://deer.social/profile/bob.bsky.social"
    );
  });

  it("renders the bio through the rich-text parser", () => {
    renderWithProviders(
      <ProfileCard
        profile={{ ...PROFILE, description: "hi from @bob.bsky.social" }}
        clientId={null}
        openProfilesInApp={false}
      />
    );
    expect(screen.getByRole("link", { name: "@bob.bsky.social" })).toBeInTheDocument();
  });
});
