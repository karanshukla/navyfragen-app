import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import PublicProfile from "../../pages/PublicProfile";
import * as profileService from "../../api/profileService";
import * as messageService from "../../api/messageService";
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
    useUserExists: vi.fn(),
    usePublicProfile: vi.fn(),
  };
});

vi.mock("../../api/messageService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/messageService")>();
  return { ...actual, useSendMessage: vi.fn() };
});

const mockUseResolveHandle = vi.mocked(profileService.useResolveHandle);
const mockUseUserExists = vi.mocked(profileService.useUserExists);
const mockUsePublicProfile = vi.mocked(profileService.usePublicProfile);
const mockUseSendMessage = vi.mocked(messageService.useSendMessage);

const TEST_DID = "did:example:karan";

function setupProfile() {
  mockUseResolveHandle.mockReturnValue({ data: { did: TEST_DID }, isLoading: false, error: null } as any);
  mockUseUserExists.mockReturnValue({ data: { exists: true }, isLoading: false, error: null } as any);
  mockUsePublicProfile.mockReturnValue({
    data: {
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

  it("shows loading indicator while handle is resolving", () => {
    mockUseResolveHandle.mockReturnValue({ data: undefined, isLoading: true, error: null } as any);
    mockUseUserExists.mockReturnValue({ data: undefined, isLoading: false, error: null } as any);
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
    mockUseUserExists.mockReturnValue({ data: undefined, isLoading: false, error: null } as any);
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
    // Display name appears in both desktop (h3) and mobile (h4) layouts
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
    // Attempting to exceed the limit leaves the value unchanged
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
});
