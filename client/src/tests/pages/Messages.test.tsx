import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import * as authService from "../../api/authService";
import * as messageService from "../../api/messageService";
import * as settingsService from "../../api/settingsService";
import Messages, { formatTimestamp } from "../../pages/Messages";
import { renderWithProviders } from "../testUtils";

vi.mock("../../api/authService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/authService")>();
  return { ...actual, useSession: vi.fn() };
});

vi.mock("../../api/messageService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../api/messageService")>();
  return {
    ...actual,
    useMessages: vi.fn(),
    useDeleteMessage: vi.fn(),
    useRespondToMessage: vi.fn(),
    useAddExampleMessages: vi.fn(),
  };
});

vi.mock("../../api/settingsService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../api/settingsService")>();
  return {
    ...actual,
    useUserSettings: vi.fn(),
    useUpdateUserSettings: vi.fn(),
  };
});

const mockUseSession = vi.mocked(authService.useSession);
const mockUseMessages = vi.mocked(messageService.useMessages);
const mockUseDeleteMessage = vi.mocked(messageService.useDeleteMessage);
const mockUseRespondToMessage = vi.mocked(messageService.useRespondToMessage);
const mockUseAddExampleMessages = vi.mocked(
  messageService.useAddExampleMessages,
);
const mockUseUserSettings = vi.mocked(settingsService.useUserSettings);
const mockUseUpdateUserSettings = vi.mocked(
  settingsService.useUpdateUserSettings,
);

const SESSION = {
  isLoggedIn: true,
  did: "did:example:1",
  profile: { displayName: "Karan", handle: "karan.bsky.social" },
};

const MESSAGES: messageService.Message[] = [
  {
    tid: "msg-1",
    message: "Hello?",
    createdAt: "2024-03-15T14:30:00.000Z",
    recipient: "did:example:1",
  },
  {
    tid: "msg-2",
    message: "What is your favorite color?",
    createdAt: "2024-03-14T10:00:00.000Z",
    recipient: "did:example:1",
  },
];

const noopMutation = { mutate: vi.fn(), isPending: false } as any;

function setupMocks(messages = MESSAGES) {
  mockUseSession.mockReturnValue({ data: SESSION, isLoading: false } as any);
  mockUseMessages.mockReturnValue({
    data: { messages },
    isLoading: false,
    refetch: vi.fn(),
  } as any);
  mockUseDeleteMessage.mockReturnValue(noopMutation);
  mockUseRespondToMessage.mockReturnValue(noopMutation);
  mockUseAddExampleMessages.mockReturnValue(noopMutation);
  mockUseUserSettings.mockReturnValue({
    data: { pdsSyncEnabled: false, imageTheme: "default" },
    isLoading: false,
  } as any);
  mockUseUpdateUserSettings.mockReturnValue(noopMutation);
}

// ── formatTimestamp ──────────────────────────────────────────────────────────

describe("formatTimestamp", () => {
  it("includes the year", () => {
    expect(formatTimestamp("2024-03-15T14:30:00.000Z")).toContain("2024");
  });

  it("includes hours and zero-padded minutes", () => {
    expect(formatTimestamp("2024-03-15T14:30:00.000Z")).toMatch(
      /\d{1,2}:\d{2}/,
    );
  });

  it("includes a timezone abbreviation", () => {
    // e.g. UTC, GMT, EST, EDT, AEST — at least two consecutive uppercase letters
    expect(formatTimestamp("2024-03-15T14:30:00.000Z")).toMatch(/[A-Z]{2,}/);
  });

  it("produces different output for different dates", () => {
    const t1 = formatTimestamp("2023-01-01T00:00:00.000Z");
    const t2 = formatTimestamp("2024-12-31T23:59:00.000Z");
    expect(t1).not.toEqual(t2);
  });
});

// ── Messages page ────────────────────────────────────────────────────────────

describe("Messages page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("shows a loader while session is loading", () => {
    mockUseSession.mockReturnValue({ data: undefined, isLoading: true } as any);
    mockUseMessages.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch: vi.fn(),
    } as any);
    mockUseDeleteMessage.mockReturnValue(noopMutation);
    mockUseRespondToMessage.mockReturnValue(noopMutation);
    mockUseAddExampleMessages.mockReturnValue(noopMutation);
    mockUseUserSettings.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as any);
    mockUseUpdateUserSettings.mockReturnValue(noopMutation);
    renderWithProviders(<Messages />);
    expect(screen.queryByText(/posting preferences/i)).toBeNull();
  });

  it("shows 'not logged in' alert when session is absent", () => {
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: false },
      isLoading: false,
    } as any);
    mockUseMessages.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch: vi.fn(),
    } as any);
    mockUseDeleteMessage.mockReturnValue(noopMutation);
    mockUseRespondToMessage.mockReturnValue(noopMutation);
    mockUseAddExampleMessages.mockReturnValue(noopMutation);
    mockUseUserSettings.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as any);
    mockUseUpdateUserSettings.mockReturnValue(noopMutation);
    renderWithProviders(<Messages />);
    expect(screen.getByText(/not logged in/i)).toBeInTheDocument();
  });

  it("renders Posting preferences and Image theme panel headers when messages exist", () => {
    setupMocks();
    renderWithProviders(<Messages />);
    expect(screen.getByText(/posting preferences/i)).toBeInTheDocument();
    expect(screen.getByText(/image theme/i)).toBeInTheDocument();
  });

  it("renders message card content", () => {
    setupMocks();
    renderWithProviders(<Messages />);
    expect(screen.getByText("Hello?")).toBeInTheDocument();
    expect(
      screen.getByText("What is your favorite color?"),
    ).toBeInTheDocument();
  });

  it("renders timestamps containing the year (not relative time)", () => {
    setupMocks();
    renderWithProviders(<Messages />);
    const yearMatches = screen.getAllByText(/2024/);
    expect(yearMatches.length).toBeGreaterThan(0);
  });

  it("clicking 'Posting preferences' header does not throw", () => {
    setupMocks();
    renderWithProviders(<Messages />);
    expect(() =>
      fireEvent.click(screen.getByText(/posting preferences/i)),
    ).not.toThrow();
  });

  it("clicking 'Image theme' header does not throw", () => {
    setupMocks();
    renderWithProviders(<Messages />);
    expect(() =>
      fireEvent.click(screen.getByText(/image theme/i)),
    ).not.toThrow();
  });

  it("renders Auto-scroll to messages switch in the preferences panel", () => {
    setupMocks();
    renderWithProviders(<Messages />);
    expect(screen.getByText(/auto-scroll to messages/i)).toBeInTheDocument();
  });

  it("preferences counter reflects 5 total toggles", () => {
    setupMocks();
    renderWithProviders(<Messages />);
    expect(screen.getByText(/of 5 on/i)).toBeInTheDocument();
  });

  it("calls scrollIntoView with block:nearest when messages first load", async () => {
    const scrollSpy = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    setupMocks();
    renderWithProviders(<Messages />);
    await waitFor(() => {
      expect(scrollSpy).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "nearest",
      });
    });
    scrollSpy.mockRestore();
  });

  it("does not call scrollIntoView when auto-scroll preference is off", async () => {
    localStorage.setItem("autoScrollToMessages", JSON.stringify(false));
    const scrollSpy = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => {});

    // Start with no messages so the initial mount cannot trigger the scroll
    setupMocks([]);
    const { rerender } = renderWithProviders(<Messages />);

    // Wait for localStorage hydration (getInitialValueInEffect: true means it fires
    // after mount). The panel renders when messages exist, so we confirm the empty
    // state is stable first.
    await waitFor(() => {
      expect(screen.queryByText("Hello?")).toBeNull();
    });

    // Now simulate new messages arriving — count goes 0 → 2, but autoScroll is false
    mockUseMessages.mockReturnValue({
      data: { messages: MESSAGES },
      isLoading: false,
      refetch: vi.fn(),
    } as any);
    rerender(<Messages />);

    await waitFor(() => {
      expect(screen.getByText("Hello?")).toBeInTheDocument();
    });

    expect(scrollSpy).not.toHaveBeenCalledWith({
      behavior: "smooth",
      block: "nearest",
    });
    scrollSpy.mockRestore();
  });

  it("does not render panel headers when there are no messages", () => {
    setupMocks([]);
    renderWithProviders(<Messages />);
    expect(screen.queryByText(/posting preferences/i)).toBeNull();
    expect(screen.queryByText(/image theme/i)).toBeNull();
  });

  it("shows a welcome-back toast notification after a new login", async () => {
    sessionStorage.setItem("newLogin", "true");
    setupMocks();
    renderWithProviders(<Messages />);
    await waitFor(() => {
      expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    });
    expect(sessionStorage.getItem("newLogin")).toBeNull();
  });

  it("shows an error toast notification when delete fails", async () => {
    let capturedCallbacks: any;
    setupMocks();
    const mockDeleteMutate = vi.fn((_tid: string, callbacks: any) => {
      capturedCallbacks = callbacks;
    });
    mockUseDeleteMessage.mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Messages />);

    const deleteButtons = screen.getAllByRole("button", {
      name: /delete message/i,
    });
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => expect(mockDeleteMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onError({ error: "Network error" });
    });

    await waitFor(() => {
      expect(screen.getByText(/error deleting message/i)).toBeInTheDocument();
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it("pressing Escape in the response textarea closes the response area", async () => {
    setupMocks();
    renderWithProviders(<Messages />);

    const replyButtons = screen.getAllByRole("button", { name: /reply/i });
    const openReplyBtn = replyButtons.find((b) => b.textContent?.includes("↩"));
    fireEvent.click(openReplyBtn!);

    await waitFor(() =>
      screen.getByRole("textbox", { name: /your response/i }),
    );
    fireEvent.keyDown(screen.getByRole("textbox", { name: /your response/i }), {
      key: "Escape",
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("textbox", { name: /your response/i }),
      ).toBeNull();
    });
  });

  it("pressing Enter (without Shift) in response textarea submits the response", async () => {
    const mockRespondMutate = vi.fn();
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({
      mutate: mockRespondMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Messages />);

    const replyButtons = screen.getAllByRole("button", { name: /reply/i });
    const openReplyBtn = replyButtons.find((b) => b.textContent?.includes("↩"));
    fireEvent.click(openReplyBtn!);

    await waitFor(() =>
      screen.getByRole("textbox", { name: /your response/i }),
    );
    const textarea = screen.getByRole("textbox", { name: /your response/i });
    fireEvent.change(textarea, { target: { value: "My answer!" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalled());
  });

  it("shows an error toast notification when responding fails", async () => {
    let capturedRespondCallbacks: any;
    setupMocks();
    const mockRespondMutate = vi.fn((_data: any, callbacks: any) => {
      capturedRespondCallbacks = callbacks;
    });
    mockUseRespondToMessage.mockReturnValue({
      mutate: mockRespondMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Messages />);

    // Click the "↩ Reply" button (text button to open the response area)
    const replyButtons = screen.getAllByRole("button", { name: /reply/i });
    const openReplyBtn = replyButtons.find((b) => b.textContent?.includes("↩"));
    fireEvent.click(openReplyBtn!);

    // Wait for the response textarea to appear
    await waitFor(() =>
      screen.getByRole("textbox", { name: /your response/i }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: /your response/i }), {
      target: { value: "Great question!" },
    });

    // Click the "Reply" send button (the gradient button inside the response box)
    const sendReplyBtn = screen.getByRole("button", { name: /^reply$/i });
    fireEvent.click(sendReplyBtn);
    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalled());

    act(() => {
      capturedRespondCallbacks.onError({ error: "Post failed" });
    });

    await waitFor(() => {
      expect(screen.getByText(/response error/i)).toBeInTheDocument();
    });
  });
});
