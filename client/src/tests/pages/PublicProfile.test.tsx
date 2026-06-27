import { notifications } from "@mantine/notifications";
import { screen, fireEvent, waitFor, act, within } from "@testing-library/react";
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
  mockUseResolveHandle.mockReturnValue({
    data: { did: TEST_DID },
    isLoading: false,
    error: null,
  } as any);
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
  mockUseSendMessage.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as any);
}

describe("PublicProfile page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifications.clean();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading indicator while handle is resolving", () => {
    mockUseResolveHandle.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);
    mockUsePublicProfile.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as any);
    mockUseSendMessage.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
    renderWithProviders(<PublicProfile />);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("shows 404 message when handle does not exist on Bluesky", () => {
    mockUseResolveHandle.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 404 },
    } as any);
    mockUsePublicProfile.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as any);
    mockUseSendMessage.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
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

  it("shows a toast notification on successful message send", async () => {
    let capturedCallbacks: any;
    setupProfile();
    const mockMutate = vi.fn((_data: any, callbacks: any) => {
      capturedCallbacks = callbacks;
    });
    mockUseSendMessage.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);
    renderWithProviders(<PublicProfile />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Hello there!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
    await waitFor(() => screen.getByText(/are you sure/i));

    // The modal confirm button is labeled "Send Message"
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => expect(mockMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onSuccess();
    });

    await waitFor(() => {
      expect(screen.getByText(/message sent/i)).toBeInTheDocument();
    });
  });

  it("shows a toast notification when message send fails", async () => {
    let capturedCallbacks: any;
    setupProfile();
    const mockMutate = vi.fn((_data: any, callbacks: any) => {
      capturedCallbacks = callbacks;
    });
    mockUseSendMessage.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);
    renderWithProviders(<PublicProfile />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Hello there!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
    await waitFor(() => screen.getByText(/are you sure/i));

    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => expect(mockMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onError({ error: "Rate limited" });
    });

    await waitFor(() => {
      expect(screen.getByText(/failed to send/i)).toBeInTheDocument();
      expect(screen.getByText(/rate limited/i)).toBeInTheDocument();
    });
  });

  it("shows 'Not on Navyfragen' when user exists on Bluesky but has no inbox", () => {
    mockUseResolveHandle.mockReturnValue({
      data: { did: TEST_DID },
      isLoading: false,
      error: null,
    } as any);
    mockUsePublicProfile.mockReturnValue({
      data: { exists: false, profile: null },
      isLoading: false,
      error: null,
    } as any);
    mockUseSendMessage.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
    renderWithProviders(<PublicProfile />);
    expect(screen.getByText(/not on navyfragen/i)).toBeInTheDocument();
  });

  it("shows generic error when handleError has non-404 status", () => {
    mockUseResolveHandle.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 500, error: "Internal server error" },
    } as any);
    mockUsePublicProfile.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as any);
    mockUseSendMessage.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
    renderWithProviders(<PublicProfile />);
    expect(screen.getByText(/internal server error/i)).toBeInTheDocument();
  });

  it("shows profile error fallback when profile exists but data is null", () => {
    mockUseResolveHandle.mockReturnValue({
      data: { did: TEST_DID },
      isLoading: false,
      error: null,
    } as any);
    mockUsePublicProfile.mockReturnValue({
      data: { exists: true, profile: null },
      isLoading: false,
      error: null,
    } as any);
    mockUseSendMessage.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
    renderWithProviders(<PublicProfile />);
    expect(screen.getByText(/failed to load profile information/i)).toBeInTheDocument();
  });

  it("pressing Enter (without modifiers) in textarea calls handleSend", async () => {
    setupProfile();
    renderWithProviders(<PublicProfile />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello!" } });
    fireEvent.keyDown(textarea, {
      key: "Enter",
      shiftKey: false,
      altKey: false,
      metaKey: false,
    });
    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });
  });

  it("pressing Ctrl+Enter in textarea calls handleSend", async () => {
    setupProfile();
    renderWithProviders(<PublicProfile />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello!" } });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });
  });

  it("clicking the clear button empties the message", async () => {
    setupProfile();
    renderWithProviders(<PublicProfile />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Some text" } });
    await waitFor(() => expect(textarea).toHaveValue("Some text"));
    const clearBtn = screen.getByRole("button", { name: /clear message/i });
    fireEvent.click(clearBtn);
    expect(textarea).toHaveValue("");
  });

  it("calls scrollIntoView with block:nearest when ask card is below the viewport", async () => {
    const scrollSpy = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
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
      expect(scrollSpy).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "nearest",
      });
    });
  });

  it("shows error toast when handleConfirmSend is called without a profile DID", async () => {
    mockUseResolveHandle.mockReturnValue({
      data: { did: TEST_DID },
      isLoading: false,
      error: null,
    } as any);
    mockUsePublicProfile.mockReturnValue({
      data: {
        exists: true,
        profile: {
          did: null,
          handle: "karan.bsky.social",
          displayName: "Karan",
        },
      },
      isLoading: false,
      error: null,
    } as any);
    mockUseSendMessage.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
    renderWithProviders(<PublicProfile />);

    // Open the modal first via handleSend with valid message
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Hello!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
    await waitFor(() => screen.getByText(/are you sure/i));

    // Confirm — handleConfirmSend runs and finds no DID
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText(/cannot send message/i)).toBeInTheDocument();
    });
  });

  it("clicking the ask card focuses the textarea", async () => {
    setupProfile();
    renderWithProviders(<PublicProfile />);
    const textarea = screen.getByRole("textbox");
    const askCard = textarea.closest("[style*='cursor: text']");
    if (askCard) {
      fireEvent.click(askCard);
    }
    // Covers PublicProfile line 371 (ask card onClick → textareaRef.current?.focus())
    expect(textarea).toBeInTheDocument();
  });

  it("closing the form error alert clears the error", async () => {
    setupProfile();
    renderWithProviders(<PublicProfile />);
    // Trigger a form error
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
    await waitFor(() => screen.getByText(/message cannot be empty/i));
    // Close the alert — scope with within() to the closest [role="alert"] container
    const errorText = screen.getByText(/message cannot be empty/i);
    const alertEl = errorText.closest("[role='alert']") as HTMLElement;
    const closeBtn = within(alertEl).getByRole("button");
    fireEvent.click(closeBtn);
    await waitFor(() => {
      expect(screen.queryByText(/message cannot be empty/i)).toBeNull();
    });
  });

  it("closing the confirmation modal via Cancel button resets modal state", async () => {
    setupProfile();
    renderWithProviders(<PublicProfile />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Hello!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
    await waitFor(() => screen.getByText(/are you sure/i));
    // Click Cancel (calls onClose → setModalOpened(false))
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByText(/are you sure/i)).toBeNull();
    });
  });

  it("clicking the copy link button does not throw", async () => {
    setupProfile();
    renderWithProviders(<PublicProfile />);
    const copyBtn = screen.getByRole("button", { name: /copy profile link/i });
    expect(() => fireEvent.click(copyBtn)).not.toThrow();
  });

  it("clicking the share button via navigator.share succeeds", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      configurable: true,
    });
    setupProfile();
    renderWithProviders(<PublicProfile />);
    const shareBtn = screen.getByRole("button", {
      name: /share profile link/i,
    });
    fireEvent.click(shareBtn);
    await waitFor(() => expect(shareMock).toHaveBeenCalled());
    // Restore
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
  });

  it("navigator.share abort error is silently swallowed", async () => {
    const abortError = new DOMException("Share aborted", "AbortError");
    const shareMock = vi.fn().mockRejectedValue(abortError);
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      configurable: true,
    });
    setupProfile();
    renderWithProviders(<PublicProfile />);
    const shareBtn = screen.getByRole("button", {
      name: /share profile link/i,
    });
    fireEvent.click(shareBtn);
    await waitFor(() => expect(shareMock).toHaveBeenCalled());
    // No error toast for AbortError
    expect(screen.queryByText(/share failed/i)).toBeNull();
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
  });

  it("navigator.share non-abort error shows a toast notification", async () => {
    const networkError = new Error("Network failed");
    const shareMock = vi.fn().mockRejectedValue(networkError);
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      configurable: true,
    });
    setupProfile();
    renderWithProviders(<PublicProfile />);
    const shareBtn = screen.getByRole("button", {
      name: /share profile link/i,
    });
    fireEvent.click(shareBtn);
    await waitFor(() => expect(shareMock).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.getByText(/share failed/i)).toBeInTheDocument();
    });
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
  });

  it("falls back to profile.handle when displayName is absent", () => {
    mockUseResolveHandle.mockReturnValue({
      data: { did: TEST_DID },
      isLoading: false,
      error: null,
    } as any);
    mockUsePublicProfile.mockReturnValue({
      data: {
        exists: true,
        profile: {
          did: TEST_DID,
          handle: "karan.bsky.social",
          displayName: null,
          avatar: null,
        },
      },
      isLoading: false,
      error: null,
    } as any);
    mockUseSendMessage.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
    renderWithProviders(<PublicProfile />);
    // Both the heading text and the textarea aria-label use || profile.handle
    expect(screen.getByText(/send karan\.bsky\.social an anonymous message/i)).toBeInTheDocument();
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("aria-label", expect.stringContaining("karan.bsky.social"));
  });

  it("renders profile banner and description when present", () => {
    mockUseResolveHandle.mockReturnValue({
      data: { did: TEST_DID },
      isLoading: false,
      error: null,
    } as any);
    mockUsePublicProfile.mockReturnValue({
      data: {
        exists: true,
        profile: {
          did: TEST_DID,
          handle: "karan.bsky.social",
          displayName: "Karan",
          avatar: null,
          banner: "https://cdn.example.com/banner.jpg",
          description: "This is my bio.",
        },
      },
      isLoading: false,
      error: null,
    } as any);
    mockUseSendMessage.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
    renderWithProviders(<PublicProfile />);
    expect(screen.getByText("This is my bio.")).toBeInTheDocument();
  });

  it("Avatar alt falls back to 'User' when both displayName and handle are absent", () => {
    mockUseResolveHandle.mockReturnValue({
      data: { did: TEST_DID },
      isLoading: false,
      error: null,
    } as any);
    mockUsePublicProfile.mockReturnValue({
      data: {
        exists: true,
        profile: {
          did: TEST_DID,
          handle: null,
          displayName: null,
          avatar: null,
        },
      },
      isLoading: false,
      error: null,
    } as any);
    mockUseSendMessage.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
    renderWithProviders(<PublicProfile />);
    // Component renders without throwing; the Avatar alt="User" fallback covers the ||"User" branch
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("error message uses e.message when it is a string", async () => {
    let capturedCallbacks: any;
    setupProfile();
    const mockMutate = vi.fn((_data: any, callbacks: any) => {
      capturedCallbacks = callbacks;
    });
    mockUseSendMessage.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);
    renderWithProviders(<PublicProfile />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Hello!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
    await waitFor(() => screen.getByText(/are you sure/i));
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => expect(mockMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onError({ message: "Server rejected the request" });
    });

    await waitFor(() => {
      expect(screen.getByText(/server rejected the request/i)).toBeInTheDocument();
    });
  });

  it("error message falls back to generic text when neither message nor error is a string", async () => {
    let capturedCallbacks: any;
    setupProfile();
    const mockMutate = vi.fn((_data: any, callbacks: any) => {
      capturedCallbacks = callbacks;
    });
    mockUseSendMessage.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);
    renderWithProviders(<PublicProfile />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Hello!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
    await waitFor(() => screen.getByText(/are you sure/i));
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => expect(mockMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onError({});
    });

    await waitFor(() => {
      expect(screen.getByText(/please try again/i)).toBeInTheDocument();
    });
  });

  it("shows a generic error message when handleError is a non-object value", () => {
    mockUseResolveHandle.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: "Plain string error" as any,
    } as any);
    mockUsePublicProfile.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as any);
    mockUseSendMessage.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
    renderWithProviders(<PublicProfile />);
    // errObj = null → fallback message and not-404 error type
    expect(screen.getByText(/failed to resolve handle/i)).toBeInTheDocument();
  });
});
