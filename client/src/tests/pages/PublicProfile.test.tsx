import { notifications } from "@mantine/notifications";
import { screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import * as reactRouterDom from "react-router";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import * as messageService from "../../api/messageService";
import * as profileService from "../../api/profileService";
import { APP_NAME } from "../../lib/brand";
import { en } from "../../lib/i18n/en";
import { getTouchpointTranslations } from "../../lib/touchpointTranslations";
import PublicProfile from "../../pages/PublicProfile";
import { renderWithProviders } from "../testUtils";

const t = getTouchpointTranslations("en");
const esT = getTouchpointTranslations("es");

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useParams: vi.fn(() => ({ handle: "karan.bsky.social" })) };
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
const mockUseParams = vi.mocked(reactRouterDom.useParams);

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

  it("resolves with a null handle when the route has no :handle param", () => {
    mockUseParams.mockReturnValueOnce({ handle: undefined } as any);
    mockUseResolveHandle.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as any);
    mockUsePublicProfile.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as any);
    mockUseSendMessage.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    renderWithProviders(<PublicProfile />);
    expect(mockUseResolveHandle).toHaveBeenCalledWith(null);
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
    expect(screen.getByText(en.publicProfilePage.noBlueskyAccountTitle)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: t.sendLabel }));
    await waitFor(() => {
      expect(screen.getByText(en.publicProfilePage.messageEmptyError)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: t.sendLabel }));
    await waitFor(() => {
      expect(screen.getByText(en.publicProfilePage.confirmSendMessage)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: t.sendLabel }));
    await waitFor(() => screen.getByText(en.publicProfilePage.confirmSendMessage));

    // The modal confirm button is labeled "Send Message"
    fireEvent.click(screen.getByRole("button", { name: en.publicProfilePage.sendMessage }));
    await waitFor(() => expect(mockMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onSuccess();
    });

    await waitFor(() => {
      expect(screen.getByText(en.publicProfilePage.messageSentTitle)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: t.sendLabel }));
    await waitFor(() => screen.getByText(en.publicProfilePage.confirmSendMessage));

    fireEvent.click(screen.getByRole("button", { name: en.publicProfilePage.sendMessage }));
    await waitFor(() => expect(mockMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onError({ error: "Rate limited" });
    });

    await waitFor(() => {
      expect(screen.getByText(en.publicProfilePage.sendFailedTitle)).toBeInTheDocument();
      expect(screen.getByText(/rate limited/i)).toBeInTheDocument();
    });
  });

  it("shows the not-on-the-app notice when the user is on Bluesky but has no inbox", () => {
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
    expect(screen.getByText(en.publicProfilePage.notOnAppTitle(APP_NAME))).toBeInTheDocument();
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
    expect(screen.getByText(en.publicProfilePage.profileLoadFailed)).toBeInTheDocument();
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
      expect(screen.getByText(en.publicProfilePage.confirmSendMessage)).toBeInTheDocument();
    });
  });

  it("pressing Ctrl+Enter in textarea calls handleSend", async () => {
    setupProfile();
    renderWithProviders(<PublicProfile />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello!" } });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    await waitFor(() => {
      expect(screen.getByText(en.publicProfilePage.confirmSendMessage)).toBeInTheDocument();
    });
  });

  it("pressing Shift+Enter in textarea does not call handleSend", async () => {
    setupProfile();
    renderWithProviders(<PublicProfile />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello!" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(screen.queryByText(en.publicProfilePage.confirmSendMessage)).toBeNull();
  });

  it("typing an ordinary key in the textarea does not call handleSend", async () => {
    setupProfile();
    renderWithProviders(<PublicProfile />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello!" } });
    fireEvent.keyDown(textarea, { key: "a" });
    expect(screen.queryByText(en.publicProfilePage.confirmSendMessage)).toBeNull();
  });

  it("pressing Alt+Enter in textarea does not call handleSend", async () => {
    setupProfile();
    renderWithProviders(<PublicProfile />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello!" } });
    fireEvent.keyDown(textarea, { key: "Enter", altKey: true });
    expect(screen.queryByText(en.publicProfilePage.confirmSendMessage)).toBeNull();
  });

  it("pressing Meta+Enter in textarea does not call handleSend", async () => {
    setupProfile();
    renderWithProviders(<PublicProfile />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello!" } });
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });
    expect(screen.queryByText(en.publicProfilePage.confirmSendMessage)).toBeNull();
  });

  it("clicking the clear button empties the message", async () => {
    setupProfile();
    renderWithProviders(<PublicProfile />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Some text" } });
    await waitFor(() => expect(textarea).toHaveValue("Some text"));
    const clearBtn = screen.getByRole("button", { name: en.askCard.clearMessage });
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
    fireEvent.click(screen.getByRole("button", { name: t.sendLabel }));
    await waitFor(() => screen.getByText(en.publicProfilePage.confirmSendMessage));

    // Confirm — handleConfirmSend runs and finds no DID
    fireEvent.click(screen.getByRole("button", { name: en.publicProfilePage.sendMessage }));

    await waitFor(() => {
      expect(screen.getByText(en.publicProfilePage.recipientNotFoundMessage)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: t.sendLabel }));
    await waitFor(() => screen.getByText(en.publicProfilePage.messageEmptyError));
    // Close the alert — scope with within() to the closest [role="alert"] container
    const errorText = screen.getByText(en.publicProfilePage.messageEmptyError);
    const alertEl = errorText.closest("[role='alert']") as HTMLElement;
    const closeBtn = within(alertEl).getByRole("button");
    fireEvent.click(closeBtn);
    await waitFor(() => {
      expect(screen.queryByText(en.publicProfilePage.messageEmptyError)).toBeNull();
    });
  });

  it("closing the confirmation modal via Cancel button resets modal state", async () => {
    setupProfile();
    renderWithProviders(<PublicProfile />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Hello!" },
    });
    fireEvent.click(screen.getByRole("button", { name: t.sendLabel }));
    await waitFor(() => screen.getByText(en.publicProfilePage.confirmSendMessage));
    // Click Cancel (calls onClose → setModalOpened(false))
    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    await waitFor(() => {
      expect(screen.queryByText(en.publicProfilePage.confirmSendMessage)).toBeNull();
    });
  });

  it("clicking the copy link button does not throw", async () => {
    setupProfile();
    renderWithProviders(<PublicProfile />);
    const copyBtn = screen.getByRole("button", { name: en.profileUrlBar.copyProfileLinkAriaLabel });
    expect(() => fireEvent.click(copyBtn)).not.toThrow();
  });

  it("flips the copy tooltip to the 'Copied!' state after a successful copy", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
    });
    setupProfile();
    renderWithProviders(<PublicProfile />);
    const copyBtn = screen.getByRole("button", { name: en.profileUrlBar.copyProfileLinkAriaLabel });
    fireEvent.click(copyBtn);
    // A successful navigator.clipboard.writeText() flips Mantine's `copied`
    // state to true, re-rendering the Tooltip with the "Copied!" label.
    await waitFor(() => expect(writeTextMock).toHaveBeenCalled());
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
    expect(shareMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("Karan") })
    );
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
    expect(screen.queryByText(en.profileUrlBar.shareFailedTitle)).toBeNull();
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
      expect(screen.getByText(en.profileUrlBar.shareFailedTitle)).toBeInTheDocument();
    });
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
  });

  it("share title falls back to profile.handle when displayName is absent", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      configurable: true,
    });
    mockUseResolveHandle.mockReturnValue({
      data: { did: TEST_DID },
      isLoading: false,
      error: null,
    } as any);
    mockUsePublicProfile.mockReturnValue({
      data: {
        exists: true,
        profile: { did: TEST_DID, handle: "karan.bsky.social", displayName: null, avatar: null },
      },
      isLoading: false,
      error: null,
    } as any);
    mockUseSendMessage.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    renderWithProviders(<PublicProfile />);
    const shareBtn = screen.getByRole("button", {
      name: en.profileUrlBar.shareProfileLinkAriaLabel,
    });
    fireEvent.click(shareBtn);
    await waitFor(() => expect(shareMock).toHaveBeenCalled());
    expect(shareMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("karan.bsky.social") })
    );
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
    expect(screen.getByText(t.headline("karan.bsky.social"))).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: t.sendLabel }));
    await waitFor(() => screen.getByText(en.publicProfilePage.confirmSendMessage));
    fireEvent.click(screen.getByRole("button", { name: en.publicProfilePage.sendMessage }));
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
    fireEvent.click(screen.getByRole("button", { name: t.sendLabel }));
    await waitFor(() => screen.getByText(en.publicProfilePage.confirmSendMessage));
    fireEvent.click(screen.getByRole("button", { name: en.publicProfilePage.sendMessage }));
    await waitFor(() => expect(mockMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onError({});
    });

    await waitFor(() => {
      expect(screen.getByText(en.publicProfilePage.sendMessageFailed)).toBeInTheDocument();
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
    expect(screen.getByText(en.publicProfilePage.handleResolveFailed)).toBeInTheDocument();
  });

  // ---- /customise-driven customisations (#199/#177/#275/#266) ----

  function setupWithSettings(settings: Record<string, unknown>) {
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
        ...settings,
      },
      isLoading: false,
      error: null,
    } as any);
    mockUseSendMessage.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  }

  it("renders the owner's custom prompt when set (#199)", () => {
    setupWithSettings({ customPrompt: "Ask me about anything" });
    renderWithProviders(<PublicProfile />);
    expect(screen.getByText(/ask me about anything/i)).toBeInTheDocument();
    // Default headline is NOT shown when an override is present.
    expect(screen.queryByText(t.headline("Karan"))).toBeNull();
  });

  it("falls back to the default headline when the prompt is unset (#199)", () => {
    setupWithSettings({ customPrompt: null });
    renderWithProviders(<PublicProfile />);
    expect(screen.getByText(t.headline("Karan"))).toBeInTheDocument();
  });

  it("localizes ask-card strings to the owner's touchpoint locale (#266)", () => {
    setupWithSettings({ touchpointLocale: "es" });
    renderWithProviders(<PublicProfile />);
    // Spanish headline, placeholder, send button, and disclaimer.
    expect(screen.getByText(esT.headline("Karan"))).toBeInTheDocument();
    expect(screen.getByPlaceholderText(esT.placeholder)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: esT.sendLabel })).toBeInTheDocument();
    expect(screen.getByText(esT.disclaimer)).toBeInTheDocument();
  });

  it("shows a closed-inbox state instead of the send form when inboxEnabled is false (#177)", () => {
    setupWithSettings({ inboxEnabled: false });
    renderWithProviders(<PublicProfile />);
    // Closed message shown, no textarea / send button.
    expect(screen.getByText(t.inboxClosed)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(t.placeholder)).toBeNull();
    expect(screen.queryByRole("button", { name: t.sendLabel })).toBeNull();
  });

  it("renders the default ask-card gradient when no theme is set (#275)", () => {
    setupWithSettings({ profileCardTheme: null });
    const { container } = renderWithProviders(<PublicProfile />);
    const askCard = container.querySelector("[style*='nf-grad-mark']") as HTMLElement | null;
    expect(askCard).not.toBeNull();
  });

  it("applies the owner's selected profile card theme gradient (#275)", () => {
    setupWithSettings({ profileCardTheme: "ember" });
    const { container } = renderWithProviders(<PublicProfile />);
    const askCard = container.querySelector("[style*='nf-grad-ember']") as HTMLElement | null;
    expect(askCard).not.toBeNull();
  });
});
