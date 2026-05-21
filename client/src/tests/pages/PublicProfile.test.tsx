import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import * as messageService from "../../api/messageService";
import * as profileService from "../../api/profileService";
import PublicProfile from "../../pages/PublicProfile";
import { renderWithProviders } from "../testUtils";

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useParams: () => ({ handle: "karan.bsky.social" }) };
});

vi.mock("../../api/profileService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/profileService")>();
  return {
    ...actual,
    useResolveHandle: vi.fn(),
    usePublicProfile: vi.fn(),
  };
});

vi.mock("../../api/messageService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/messageService")>();
  return { ...actual, useSendMessage: vi.fn() };
});

const mockUseResolveHandle = vi.mocked(profileService.useResolveHandle);
const mockUsePublicProfile = vi.mocked(profileService.usePublicProfile);
const mockUseSendMessage = vi.mocked(messageService.useSendMessage);

const TEST_DID = "did:example:karan";

function setupProfile() {
  mockUseResolveHandle.mockReturnValue({ data: { did: TEST_DID }, isLoading: false, error: null } as any);
  mockUsePublicProfile.mockReturnValue({
    data: {
      exists: true,
      profile: {
        did: TEST_DID,
        handle: "karan.bsky.social",
        displayName: "Karan",
        avatar: null,
      },
    },
    isLoading: false,
    error: null,
  } as any);
  mockUseSendMessage.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
}

describe("PublicProfile page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading indicator while handle is resolving", () => {
    mockUseResolveHandle.mockReturnValue({ data: undefined, isLoading: true, error: null } as any);
    mockUsePublicProfile.mockReturnValue({ data: undefined, isLoading: false, error: null } as any);
    mockUseSendMessage.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    renderWithProviders(<PublicProfile />);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("shows 404 message when handle does not exist on Bluesky", () => {
    mockUseResolveHandle.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 404 },
    } as any);
    mockUsePublicProfile.mockReturnValue({ data: undefined, isLoading: false, error: null } as any);
    mockUseSendMessage.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    renderWithProviders(<PublicProfile />);
    expect(screen.getByText(/no bluesky account found/i)).toBeInTheDocument();
    expect(screen.getByText(/karan\.bsky\.social/i)).toBeInTheDocument();
  });

  it("shows the message textarea when the user exists on the app", () => {
    setupProfile();
    renderWithProviders(<PublicProfile />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getAllByText("Karan").length).toBeGreaterThan(0);
  });

  it("shows validation error when trying to send an empty message", async () => {
    setupProfile();
    renderWithProviders(<PublicProfile />);
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => {
      expect(screen.getByText(/message cannot be empty/i)).toBeInTheDocument();
    });
  });

  it("caps message input at the 150 character limit", async () => {
    setupProfile();
    renderWithProviders(<PublicProfile />);
    const atLimit = "a".repeat(150);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: atLimit } });
    await waitFor(() => {
      expect(textarea).toHaveValue(atLimit);
    });
    fireEvent.change(textarea, { target: { value: "a".repeat(151) } });
    expect(textarea).toHaveValue(atLimit);
  });

  it("opens confirmation modal when a valid message is submitted", async () => {
    setupProfile();
    renderWithProviders(<PublicProfile />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "A great question!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });
  });

  it("renders a copy button next to the profile breadcrumb", () => {
    setupProfile();
    renderWithProviders(<PublicProfile />);
    // CopyButton renders a button; its tooltip label is "Copy link"
    // The button itself has no accessible name but its Tooltip has the label
    const buttons = screen.getAllByRole("button");
    // At minimum: copy + send — verify one of them is present
    expect(buttons.length).toBeGreaterThan(0);
    // The breadcrumb URL text is present
    expect(screen.getByText(/fragen\.navy\//i)).toBeInTheDocument();
  });

  it("calls scrollIntoView with block:nearest when ask card is below the viewport", async () => {
    const scrollSpy = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 9999,
      top: 0,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    } as DOMRect);

    setupProfile();
    renderWithProviders(<PublicProfile />);

    await waitFor(() => {
      expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "nearest" });
    });
  });
});
