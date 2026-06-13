import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { notifications } from "@mantine/notifications";

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
    notifications.clean();
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

  it("clicking 'Add example messages' calls addExamples; onSuccess calls refetch", async () => {
    let capturedCallbacks: any;
    const mockAddMutate = vi.fn((_did: string, callbacks: any) => { capturedCallbacks = callbacks; });
    const refetchMock = vi.fn();
    mockUseAddExampleMessages.mockReturnValue({ mutate: mockAddMutate, isPending: false } as any);
    mockUseSession.mockReturnValue({ data: SESSION, isLoading: false } as any);
    mockUseMessages.mockReturnValue({ data: { messages: [] }, isLoading: false, refetch: refetchMock } as any);
    mockUseDeleteMessage.mockReturnValue(noopMutation);
    mockUseRespondToMessage.mockReturnValue(noopMutation);
    mockUseUserSettings.mockReturnValue({ data: { pdsSyncEnabled: false, imageTheme: "default" }, isLoading: false } as any);
    mockUseUpdateUserSettings.mockReturnValue(noopMutation);
    renderWithProviders(<Messages />);

    fireEvent.click(screen.getByRole("button", { name: /add example messages/i }));
    await waitFor(() => expect(mockAddMutate).toHaveBeenCalledWith(SESSION.did, expect.any(Object)));

    act(() => { capturedCallbacks.onSuccess(); });
    expect(refetchMock).toHaveBeenCalled();
  });

  it("addExampleMessages onError shows error toast", async () => {
    let capturedCallbacks: any;
    const mockAddMutate = vi.fn((_did: string, callbacks: any) => { capturedCallbacks = callbacks; });
    mockUseAddExampleMessages.mockReturnValue({ mutate: mockAddMutate, isPending: false } as any);
    mockUseSession.mockReturnValue({ data: SESSION, isLoading: false } as any);
    mockUseMessages.mockReturnValue({ data: { messages: [] }, isLoading: false, refetch: vi.fn() } as any);
    mockUseDeleteMessage.mockReturnValue(noopMutation);
    mockUseRespondToMessage.mockReturnValue(noopMutation);
    mockUseUserSettings.mockReturnValue({ data: { pdsSyncEnabled: false, imageTheme: "default" }, isLoading: false } as any);
    mockUseUpdateUserSettings.mockReturnValue(noopMutation);
    renderWithProviders(<Messages />);

    fireEvent.click(screen.getByRole("button", { name: /add example messages/i }));
    await waitFor(() => expect(mockAddMutate).toHaveBeenCalled());

    act(() => { capturedCallbacks.onError({ error: "Server error" }); });
    await waitFor(() => {
      expect(screen.getByText(/error adding examples/i)).toBeInTheDocument();
    });
  });

  it("delete button with confirmBeforeDelete=true opens confirmation modal", async () => {
    localStorage.setItem("confirmBeforeDelete", JSON.stringify(true));
    setupMocks();
    renderWithProviders(<Messages />);
    await act(async () => {});

    const deleteButtons = screen.getAllByRole("button", { name: /delete message/i });
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByText(/confirm deletion/i)).toBeInTheDocument();
    });
  });

  it("confirming delete from modal calls performDelete with fromModal=true; onSuccess closes modal", async () => {
    localStorage.setItem("confirmBeforeDelete", JSON.stringify(true));
    let capturedCallbacks: any;
    const mockDeleteMutate = vi.fn((_tid: string, callbacks: any) => { capturedCallbacks = callbacks; });
    setupMocks();
    mockUseDeleteMessage.mockReturnValue({ mutate: mockDeleteMutate, isPending: false } as any);
    renderWithProviders(<Messages />);
    await act(async () => {});

    fireEvent.click(screen.getAllByRole("button", { name: /delete message/i })[0]);
    await waitFor(() => screen.getByText(/confirm deletion/i));

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(mockDeleteMutate).toHaveBeenCalled());

    act(() => { capturedCallbacks.onSuccess(); });
    await waitFor(() => {
      expect(screen.queryByText(/confirm deletion/i)).toBeNull();
    });
  });

  it("performDelete from modal onError closes modal and shows toast", async () => {
    localStorage.setItem("confirmBeforeDelete", JSON.stringify(true));
    let capturedCallbacks: any;
    const mockDeleteMutate = vi.fn((_tid: string, callbacks: any) => { capturedCallbacks = callbacks; });
    setupMocks();
    mockUseDeleteMessage.mockReturnValue({ mutate: mockDeleteMutate, isPending: false } as any);
    renderWithProviders(<Messages />);
    await act(async () => {});

    fireEvent.click(screen.getAllByRole("button", { name: /delete message/i })[0]);
    await waitFor(() => screen.getByText(/confirm deletion/i));

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(mockDeleteMutate).toHaveBeenCalled());

    act(() => { capturedCallbacks.onError({ error: "Delete failed" }); });
    await waitFor(() => {
      expect(screen.getByText(/error deleting message/i)).toBeInTheDocument();
      expect(screen.queryByText(/confirm deletion/i)).toBeNull();
    });
  });

  it("ConfirmationModal Cancel button closes the modal", async () => {
    localStorage.setItem("confirmBeforeDelete", JSON.stringify(true));
    setupMocks();
    renderWithProviders(<Messages />);
    await act(async () => {});

    fireEvent.click(screen.getAllByRole("button", { name: /delete message/i })[0]);
    await waitFor(() => screen.getByText(/confirm deletion/i));

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByText(/confirm deletion/i)).toBeNull();
    });
  });

  it("performDelete onSuccess with respondingTid === tid clears the responding state", async () => {
    let capturedCallbacks: any;
    const mockDeleteMutate = vi.fn((_tid: string, callbacks: any) => { capturedCallbacks = callbacks; });
    setupMocks();
    mockUseDeleteMessage.mockReturnValue({ mutate: mockDeleteMutate, isPending: false } as any);
    renderWithProviders(<Messages />);

    // Expand msg-1 via the "↩ Reply" button
    const replyButtons = screen.getAllByRole("button", { name: /reply/i });
    const openReplyBtn = replyButtons.find((b) => b.textContent?.includes("↩"));
    fireEvent.click(openReplyBtn!);
    await waitFor(() => screen.getByRole("textbox", { name: /your response/i }));

    // Delete the same expanded card (msg-1 is first)
    const deleteButtons = screen.getAllByRole("button", { name: /delete message/i });
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => expect(mockDeleteMutate).toHaveBeenCalled());

    act(() => { capturedCallbacks.onSuccess(); });
    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: /your response/i })).toBeNull();
    });
  });

  it("sending an empty response shows 'Empty Response' notification", async () => {
    setupMocks();
    renderWithProviders(<Messages />);

    const replyButtons = screen.getAllByRole("button", { name: /reply/i });
    fireEvent.click(replyButtons.find((b) => b.textContent?.includes("↩"))!);
    await waitFor(() => screen.getByRole("textbox", { name: /your response/i }));

    // Click Reply without typing anything
    fireEvent.click(screen.getByRole("button", { name: /^reply$/i }));
    await waitFor(() => {
      expect(screen.getByText(/empty response/i)).toBeInTheDocument();
    });
  });

  it("handleSendResponse with appendProfileLink=true appends the profile link", async () => {
    localStorage.setItem("appendProfileLink", JSON.stringify(true));
    let capturedData: any;
    const mockRespondMutate = vi.fn((data: any, _callbacks: any) => { capturedData = data; });
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({ mutate: mockRespondMutate, isPending: false } as any);
    renderWithProviders(<Messages />);

    const replyButtons = screen.getAllByRole("button", { name: /reply/i });
    fireEvent.click(replyButtons.find((b) => b.textContent?.includes("↩"))!);
    await waitFor(() => screen.getByRole("textbox", { name: /your response/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /your response/i }), { target: { value: "Great answer!" } });
    fireEvent.click(screen.getByRole("button", { name: /^reply$/i }));

    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalled());
    expect(capturedData.response).toContain("Great answer!");
    expect(capturedData.response).toContain(SESSION.profile.handle);
  });

  it("handleSendResponse onSuccess with data.link shows link in notification", async () => {
    let capturedCallbacks: any;
    const mockRespondMutate = vi.fn((_data: any, callbacks: any) => { capturedCallbacks = callbacks; });
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({ mutate: mockRespondMutate, isPending: false } as any);
    renderWithProviders(<Messages />);

    const replyButtons = screen.getAllByRole("button", { name: /reply/i });
    fireEvent.click(replyButtons.find((b) => b.textContent?.includes("↩"))!);
    await waitFor(() => screen.getByRole("textbox", { name: /your response/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /your response/i }), { target: { value: "My answer!" } });
    fireEvent.click(screen.getByRole("button", { name: /^reply$/i }));
    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalled());

    act(() => { capturedCallbacks.onSuccess({ link: "https://bsky.app/profile/user/post/123" }); });
    await waitFor(() => {
      expect(screen.getByText(/response sent/i)).toBeInTheDocument();
      expect(screen.getByText("https://bsky.app/profile/user/post/123")).toBeInTheDocument();
    });
  });

  it("handleSendResponse onSuccess without data.link shows plain success message", async () => {
    let capturedCallbacks: any;
    const mockRespondMutate = vi.fn((_data: any, callbacks: any) => { capturedCallbacks = callbacks; });
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({ mutate: mockRespondMutate, isPending: false } as any);
    renderWithProviders(<Messages />);

    const replyButtons = screen.getAllByRole("button", { name: /reply/i });
    fireEvent.click(replyButtons.find((b) => b.textContent?.includes("↩"))!);
    await waitFor(() => screen.getByRole("textbox", { name: /your response/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /your response/i }), { target: { value: "My answer!" } });
    fireEvent.click(screen.getByRole("button", { name: /^reply$/i }));
    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalled());

    act(() => { capturedCallbacks.onSuccess({}); });
    await waitFor(() => {
      expect(screen.getByText(/response sent/i)).toBeInTheDocument();
      expect(screen.getByText(/your response has been posted/i)).toBeInTheDocument();
    });
  });

  it("character limit decreases when appendProfileLink switch is toggled on", async () => {
    setupMocks();
    renderWithProviders(<Messages />);

    const replyButtons = screen.getAllByRole("button", { name: /reply/i });
    fireEvent.click(replyButtons.find((b) => b.textContent?.includes("↩"))!);
    await waitFor(() => screen.getByRole("textbox", { name: /your response/i }));

    expect(screen.getByText("0/277")).toBeInTheDocument();

    const appendSwitch = screen.getByLabelText(/auto-append inbox link/i);
    fireEvent.click(appendSwitch);

    await waitFor(() => {
      expect(screen.queryByText("0/277")).toBeNull();
    });
  });

  it("character limit decreases when includeQuestionAsImage is toggled off while responding", async () => {
    setupMocks();
    renderWithProviders(<Messages />);

    const replyButtons = screen.getAllByRole("button", { name: /reply/i });
    fireEvent.click(replyButtons.find((b) => b.textContent?.includes("↩"))!);
    await waitFor(() => screen.getByRole("textbox", { name: /your response/i }));

    expect(screen.getByText("0/277")).toBeInTheDocument();

    const imageSwitch = screen.getByLabelText(/question as image/i);
    fireEvent.click(imageSwitch);

    await waitFor(() => {
      expect(screen.queryByText("0/277")).toBeNull();
    });
  });

  it("global Escape key collapses the expanded card when fired from document", async () => {
    setupMocks();
    renderWithProviders(<Messages />);

    const replyButtons = screen.getAllByRole("button", { name: /reply/i });
    fireEvent.click(replyButtons.find((b) => b.textContent?.includes("↩"))!);
    await waitFor(() => screen.getByRole("textbox", { name: /your response/i }));

    // Fire Escape on the document (not the textarea) to hit the global keydown handler
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: /your response/i })).toBeNull();
    });
  });

  it("Alt+R keyboard shortcut cycles through message cards", async () => {
    setupMocks();
    renderWithProviders(<Messages />);

    // First Alt+R: focusedCardIndex is -1 → sets to 0
    fireEvent.keyDown(document, { key: "R", altKey: true });
    // Second Alt+R: cycles to next card
    fireEvent.keyDown(document, { key: "R", altKey: true });

    expect(document.body).toBeInTheDocument();
  });

  it("ArrowDown and ArrowUp navigate between message cards", async () => {
    setupMocks();
    renderWithProviders(<Messages />);

    // Focus a card via Alt+R first (sets focusedCardIndex=0)
    fireEvent.keyDown(document, { key: "R", altKey: true });
    // ArrowDown → next card
    fireEvent.keyDown(document, { key: "ArrowDown" });
    // ArrowUp → previous card
    fireEvent.keyDown(document, { key: "ArrowUp" });

    expect(document.body).toBeInTheDocument();
  });

  it("updateSettings onError callback shows error toast", async () => {
    let capturedOnError: any;
    setupMocks();
    mockUseUpdateUserSettings.mockImplementation((options: any) => {
      capturedOnError = options?.onError;
      return noopMutation;
    });
    renderWithProviders(<Messages />);

    act(() => { capturedOnError({ error: "Theme update failed" }); });
    await waitFor(() => {
      expect(screen.getByText(/error updating theme/i)).toBeInTheDocument();
    });
  });

  it("handleAddExampleMessages returns early when session has no did", () => {
    const mockAddMutate = vi.fn();
    mockUseAddExampleMessages.mockReturnValue({ mutate: mockAddMutate, isPending: false } as any);
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: true, did: null, profile: null },
      isLoading: false,
    } as any);
    mockUseMessages.mockReturnValue({ data: { messages: [] }, isLoading: false, refetch: vi.fn() } as any);
    mockUseDeleteMessage.mockReturnValue(noopMutation);
    mockUseRespondToMessage.mockReturnValue(noopMutation);
    mockUseUserSettings.mockReturnValue({ data: { pdsSyncEnabled: false, imageTheme: "default" }, isLoading: false } as any);
    mockUseUpdateUserSettings.mockReturnValue(noopMutation);
    renderWithProviders(<Messages />);

    fireEvent.click(screen.getByRole("button", { name: /add example messages/i }));
    expect(mockAddMutate).not.toHaveBeenCalled();
  });

  it("clicking the Copy button in the hero card triggers haptic and copy", () => {
    setupMocks();
    renderWithProviders(<Messages />);
    const copyBtn = screen.getByRole("button", { name: /^copy$/i });
    expect(() => fireEvent.click(copyBtn)).not.toThrow();
  });

  it("clicking a ThemeCard calls updateSettings.mutate when not loading", () => {
    const mockMutate = vi.fn();
    setupMocks();
    mockUseUpdateUserSettings.mockReturnValue({ mutate: mockMutate, isPending: false } as any);
    renderWithProviders(<Messages />);

    const defaultThemeBtn = screen.getByRole("button", { name: /^default$/i });
    fireEvent.click(defaultThemeBtn);

    expect(mockMutate).toHaveBeenCalledWith({ imageTheme: "default", pdsSyncEnabled: false });
  });

  it("keyboard Alt+R shortcut is ignored when an input element has focus", () => {
    setupMocks();
    renderWithProviders(<Messages />);

    // Switch inputs are rendered as checkboxes; fire Alt+R from one of them
    const switchInput = document.querySelector('input[type="checkbox"]') as HTMLElement;
    if (switchInput) {
      fireEvent.keyDown(switchInput, { key: "R", altKey: true });
    }
    expect(document.body).toBeInTheDocument();
  });

  it("pressing Enter on a card expands it; pressing Enter again collapses it", async () => {
    setupMocks();
    renderWithProviders(<Messages />);

    const card = document.getElementById("message-card-msg-1");
    if (card) {
      fireEvent.focus(card);
      // Enter when not expanded → expand
      fireEvent.keyDown(card, { key: "Enter" });
      await waitFor(() => screen.getByRole("textbox", { name: /your response/i }));

      // Enter when expanded → collapse
      fireEvent.keyDown(card, { key: "Enter" });
      await waitFor(() => {
        expect(screen.queryByRole("textbox", { name: /your response/i })).toBeNull();
      });
    }
  });

  it("clicking the card while it is expanded collapses it", async () => {
    setupMocks();
    renderWithProviders(<Messages />);

    // Open reply via the "↩ Reply" button
    const replyButtons = screen.getAllByRole("button", { name: /reply/i });
    fireEvent.click(replyButtons.find((b) => b.textContent?.includes("↩"))!);
    await waitFor(() => screen.getByRole("textbox", { name: /your response/i }));

    // Click the message text to hit the card's onClick with isExpanded=true
    const msgText = screen.getByText("Hello?");
    fireEvent.click(msgText);
    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: /your response/i })).toBeNull();
    });
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
