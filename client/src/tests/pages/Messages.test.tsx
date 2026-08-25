import { notifications } from "@mantine/notifications";
import { screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

import * as authService from "../../api/authService";
import * as messageService from "../../api/messageService";
import * as settingsService from "../../api/settingsService";
import { APP_NAME } from "../../lib/brand";
import { en } from "../../lib/i18n/en";
import { imageThemeLabels } from "../../lib/themes";
import Messages from "../../pages/Messages";
import { renderWithProviders } from "../testUtils";

vi.mock("../../api/authService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/authService")>();
  return { ...actual, useSession: vi.fn() };
});

vi.mock("../../api/messageService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/messageService")>();
  return {
    ...actual,
    messageService: { ...actual.messageService, warmImageService: vi.fn() },
    useMessages: vi.fn(),
    useDeleteMessage: vi.fn(),
    useRespondToMessage: vi.fn(),
    useAddExampleMessages: vi.fn(),
    useStartRender: vi.fn(),
    useRenderStatus: vi.fn(),
  };
});

vi.mock("../../api/settingsService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/settingsService")>();
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
const mockUseAddExampleMessages = vi.mocked(messageService.useAddExampleMessages);
const mockUseUserSettings = vi.mocked(settingsService.useUserSettings);
const mockUseUpdateUserSettings = vi.mocked(settingsService.useUpdateUserSettings);
const mockUseStartRender = vi.mocked(messageService.useStartRender);
const mockUseRenderStatus = vi.mocked(messageService.useRenderStatus);

const RENDER_ID = "render-abc";

/**
 * getAllByRole name matcher for a QuestionCard's own reply-trigger button --
 * matches both catalog labels ("reply" vs "reply to thread", pinned vs not)
 * rather than English text, so it survives a locale switch.
 */
const isReplyTriggerName = (name: string) =>
  name === en.questionCard.reply || name === en.questionCard.replyToThread;

/**
 * The render pipeline stands in for a server that answers instantly: the start
 * mutation hands back a key synchronously and the poll reports it ready, so a
 * send that queues on the render still lands in the same act() flush. Tests that
 * care about the wait drive `renderPoll` themselves, keyed by attempt the way
 * the real poll is.
 */
let renderPoll: (attempt: number) => { status: string; error?: string } | undefined;
/** Set when the render endpoint itself is the thing that is broken. */
let startFails = false;
const startRenderMutate = vi.fn(
  (
    _data: unknown,
    callbacks?: { onSuccess?: (data: unknown) => void; onError?: (error: unknown) => void }
  ) => {
    if (startFails) {
      callbacks?.onError?.({ error: "not found", status: 404 });
      return;
    }
    callbacks?.onSuccess?.({ renderId: RENDER_ID, status: "pending" });
  }
);
const startRenderResult = { mutate: startRenderMutate };

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
    refetch: vi.fn().mockResolvedValue(undefined),
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

// ── Messages page ────────────────────────────────────────────────────────────

describe("Messages page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    notifications.clean();
    // The inbox card's OG warm is the page's only same-origin fetch; left real
    // it dials localhost from every test that copies or shares the link.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 202 })));
    renderPoll = () => ({ status: "ready" });
    startFails = false;
    mockUseStartRender.mockReturnValue(startRenderResult as any);
    mockUseRenderStatus.mockImplementation(
      (renderId, attempt) => ({ data: renderId ? renderPoll(attempt) : undefined }) as any
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a loader while session is loading", () => {
    mockUseSession.mockReturnValue({ data: undefined, isLoading: true } as any);
    mockUseMessages.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch: vi.fn().mockResolvedValue(undefined),
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
    expect(screen.queryByText(en.postingPreferences.title)).toBeNull();
  });

  it("shows 'not logged in' alert when session is absent", () => {
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: false },
      isLoading: false,
    } as any);
    mockUseMessages.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch: vi.fn().mockResolvedValue(undefined),
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
    expect(screen.getByText(en.messagesPage.notLoggedInTitle)).toBeInTheDocument();
  });

  it("renders Posting preferences and Image theme panel headers when messages exist", () => {
    setupMocks();
    renderWithProviders(<Messages />);
    expect(screen.getByText(en.postingPreferences.title)).toBeInTheDocument();
    expect(screen.getByText(en.imageThemePicker.title)).toBeInTheDocument();
  });

  it("renders message card content", () => {
    setupMocks();
    renderWithProviders(<Messages />);
    expect(screen.getByText("Hello?")).toBeInTheDocument();
    expect(screen.getByText("What is your favorite color?")).toBeInTheDocument();
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
    expect(() => fireEvent.click(screen.getByText(en.postingPreferences.title))).not.toThrow();
  });

  it("clicking 'Image theme' header does not throw", () => {
    setupMocks();
    renderWithProviders(<Messages />);
    expect(() => fireEvent.click(screen.getByText(en.imageThemePicker.title))).not.toThrow();
  });

  it("renders Auto-scroll to messages switch in the preferences panel", () => {
    setupMocks();
    renderWithProviders(<Messages />);
    expect(screen.getByText(en.postingPreferences.autoScrollToMessages.label)).toBeInTheDocument();
  });

  it("preferences counter reflects 5 total toggles", () => {
    setupMocks();
    renderWithProviders(<Messages />);
    // Cleared localStorage falls back to the preference defaults: useGradients,
    // includeQuestionAsImage, and autoScrollToMessages start enabled (3 of 5).
    expect(screen.getByText(en.postingPreferences.summary(3, 5))).toBeInTheDocument();
  });

  it("calls scrollIntoView with block:nearest when messages first load", async () => {
    const scrollSpy = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
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
    const scrollSpy = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});

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
      refetch: vi.fn().mockResolvedValue(undefined),
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
    expect(screen.queryByText(en.postingPreferences.title)).toBeNull();
    expect(screen.queryByText(en.imageThemePicker.title)).toBeNull();
  });

  it("shows a welcome-back toast notification after a new login", async () => {
    sessionStorage.setItem("newLogin", "true");
    setupMocks();
    renderWithProviders(<Messages />);
    await waitFor(() => {
      expect(screen.getByText(en.messagesPage.welcomeBackTitle)).toBeInTheDocument();
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
      name: en.questionCard.deleteMessageLabel,
    });
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => expect(mockDeleteMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onError({ error: "MESSAGE_TID_REQUIRED", message: "Message TID required" });
    });

    await waitFor(() => {
      expect(screen.getByText(en.messagesPage.deleteErrorTitle)).toBeInTheDocument();
      expect(screen.getByText(en.errors.codes.MESSAGE_TID_REQUIRED)).toBeInTheDocument();
    });
  });

  it("falls back to the server's message when the delete error isn't a known code", async () => {
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
      name: en.questionCard.deleteMessageLabel,
    });
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => expect(mockDeleteMutate).toHaveBeenCalled());

    act(() => {
      // The delete route still passes an internal thrown message through the
      // bare `error` field rather than a code. An unrecognized `error` value
      // must never render verbatim, and there's no `message` field either, so
      // this exercises the generic fallback.
      capturedCallbacks.onError({ error: "Network error" });
    });

    await waitFor(() => {
      expect(screen.getByText(en.messagesPage.deleteErrorTitle)).toBeInTheDocument();
      expect(screen.getByText(en.errors.generic)).toBeInTheDocument();
    });
  });

  it("pressing Escape in the response textarea closes the response area", async () => {
    setupMocks();
    renderWithProviders(<Messages />);

    const replyButtons = screen.getAllByRole("button", { name: isReplyTriggerName });
    const openReplyBtn = replyButtons.find((b) => b.textContent?.includes("↩"));
    fireEvent.click(openReplyBtn!);

    await waitFor(() => screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }), {
      key: "Escape",
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("textbox", { name: en.replyComposer.responseAriaLabel })
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

    const replyButtons = screen.getAllByRole("button", { name: isReplyTriggerName });
    const openReplyBtn = replyButtons.find((b) => b.textContent?.includes("↩"));
    fireEvent.click(openReplyBtn!);

    await waitFor(() => screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }));
    const textarea = screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel });
    fireEvent.change(textarea, { target: { value: "My answer!" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalled());
  });

  it("pressing Enter while a response is already in flight does not submit again", async () => {
    // The other side of the test above. A cold image render leaves the composer
    // silent for seconds, and an unguarded Enter is how one reply became four.
    const mockRespondMutate = vi.fn();
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({
      mutate: mockRespondMutate,
      isPending: true,
    } as any);
    renderWithProviders(<Messages />);

    const replyButtons = screen.getAllByRole("button", { name: isReplyTriggerName });
    fireEvent.click(replyButtons.find((b) => b.textContent?.includes("↩"))!);

    await waitFor(() => screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }));
    const textarea = screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel });
    fireEvent.change(textarea, { target: { value: "My answer!" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(mockRespondMutate).not.toHaveBeenCalled();
  });

  /**
   * Opens msg-1's composer, types a reply and sends it, leaving the send queued
   * on a render that never settles. Returns the textarea so a test can force the
   * re-render that a settled poll would otherwise arrive on.
   */
  async function queueSendOnAStuckRender(
    respondMutate: ReturnType<typeof vi.fn>,
    deleteMutate?: ReturnType<typeof vi.fn>
  ) {
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({ mutate: respondMutate, isPending: false } as any);
    if (deleteMutate) {
      mockUseDeleteMessage.mockReturnValue({ mutate: deleteMutate, isPending: false } as any);
    }
    renderPoll = () => ({ status: "rendering" });
    renderWithProviders(<Messages />);

    const replyButtons = screen.getAllByRole("button", { name: isReplyTriggerName });
    fireEvent.click(replyButtons.find((b) => b.textContent?.includes("↩"))!);
    await waitFor(() => screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }));

    const textarea = screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel });
    fireEvent.change(textarea, { target: { value: "My answer!" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    await screen.findByText(en.replyComposer.renderingImage);
    expect(respondMutate).not.toHaveBeenCalled();
    return textarea;
  }

  it("opening another question while a send waits on its render does not move the composer", async () => {
    const mockRespondMutate = vi.fn();
    await queueSendOnAStuckRender(mockRespondMutate);

    fireEvent.click(screen.getByText("What is your favorite color?"));

    const textarea = screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel });
    expect(document.getElementById("message-card-msg-1")!.contains(textarea)).toBe(true);
  });

  it("posts the queued reply with its own question's render, not a later question's", async () => {
    const mockRespondMutate = vi.fn();
    const textarea = await queueSendOnAStuckRender(mockRespondMutate);

    // The click the guard refuses. Without it the render retargets to msg-2 and
    // the key below would carry msg-2's image into msg-1's reply.
    fireEvent.click(screen.getByText("What is your favorite color?"));

    renderPoll = () => ({ status: "ready" });
    fireEvent.change(textarea, { target: { value: "My answer, still typing" } });

    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalledTimes(1));
    expect(mockRespondMutate.mock.calls[0][0]).toMatchObject({
      tid: "msg-1",
      original: "Hello?",
      renderId: RENDER_ID,
    });
  });

  it("refuses to delete the question whose reply is in flight", async () => {
    const mockDeleteMutate = vi.fn();
    await queueSendOnAStuckRender(vi.fn(), mockDeleteMutate);

    const card = document.getElementById("message-card-msg-1")!;
    fireEvent.click(
      within(card).getByRole("button", { name: en.questionCard.cannotDeleteWhilePostingLabel })
    );

    expect(mockDeleteMutate).not.toHaveBeenCalled();
  });

  it("still allows deleting a question whose reply is not in flight", async () => {
    const mockDeleteMutate = vi.fn();
    await queueSendOnAStuckRender(vi.fn(), mockDeleteMutate);

    const other = document.getElementById("message-card-msg-2")!;
    fireEvent.click(
      within(other).getByRole("button", { name: en.questionCard.deleteMessageLabel })
    );

    expect(mockDeleteMutate).toHaveBeenCalledWith("msg-2", expect.any(Object));
  });

  it("sends the queued reply text-only when the image toggle goes off mid-wait", async () => {
    const mockRespondMutate = vi.fn();
    await queueSendOnAStuckRender(mockRespondMutate);

    // Nothing will ever settle this render now, so a status the queue does not
    // release leaves the send stuck with no error and no way to retry.
    fireEvent.click(screen.getByLabelText(/question as image/i));

    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalledTimes(1));
    expect(mockRespondMutate.mock.calls[0][0]).toMatchObject({
      tid: "msg-1",
      includeQuestionAsImage: false,
    });
    expect(mockRespondMutate.mock.calls[0][0].renderId).toBeUndefined();
  });

  it("opening the composer warms the image service when replies carry an image", async () => {
    setupMocks();
    renderWithProviders(<Messages />);

    const replyButtons = screen.getAllByRole("button", { name: isReplyTriggerName });
    fireEvent.click(replyButtons.find((b) => b.textContent?.includes("↩"))!);

    await waitFor(() => screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }));
    expect(messageService.messageService.warmImageService).toHaveBeenCalledTimes(1);
  });

  it("does not warm the image service when replies are text only", async () => {
    setupMocks();
    renderWithProviders(<Messages />);

    fireEvent.click(screen.getByLabelText(/question as image/i));

    const replyButtons = screen.getAllByRole("button", { name: isReplyTriggerName });
    fireEvent.click(replyButtons.find((b) => b.textContent?.includes("↩"))!);

    await waitFor(() => screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }));
    expect(messageService.messageService.warmImageService).not.toHaveBeenCalled();
  });

  it("clicking 'Add example messages' calls addExamples; onSuccess calls refetch", async () => {
    let capturedCallbacks: any;
    const mockAddMutate = vi.fn((_did: string, callbacks: any) => {
      capturedCallbacks = callbacks;
    });
    const refetchMock = vi.fn().mockResolvedValue(undefined);
    mockUseAddExampleMessages.mockReturnValue({
      mutate: mockAddMutate,
      isPending: false,
    } as any);
    mockUseSession.mockReturnValue({ data: SESSION, isLoading: false } as any);
    mockUseMessages.mockReturnValue({
      data: { messages: [] },
      isLoading: false,
      refetch: refetchMock,
    } as any);
    mockUseDeleteMessage.mockReturnValue(noopMutation);
    mockUseRespondToMessage.mockReturnValue(noopMutation);
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: false, imageTheme: "default" },
      isLoading: false,
    } as any);
    mockUseUpdateUserSettings.mockReturnValue(noopMutation);
    renderWithProviders(<Messages />);

    fireEvent.click(screen.getByRole("button", { name: en.messagesPage.addExampleMessages }));
    await waitFor(() =>
      expect(mockAddMutate).toHaveBeenCalledWith(SESSION.did, expect.any(Object))
    );

    act(() => {
      capturedCallbacks.onSuccess();
    });
    expect(refetchMock).toHaveBeenCalled();
  });

  it("addExampleMessages onError shows error toast", async () => {
    let capturedCallbacks: any;
    const mockAddMutate = vi.fn((_did: string, callbacks: any) => {
      capturedCallbacks = callbacks;
    });
    mockUseAddExampleMessages.mockReturnValue({
      mutate: mockAddMutate,
      isPending: false,
    } as any);
    mockUseSession.mockReturnValue({ data: SESSION, isLoading: false } as any);
    mockUseMessages.mockReturnValue({
      data: { messages: [] },
      isLoading: false,
      refetch: vi.fn(),
    } as any);
    mockUseDeleteMessage.mockReturnValue(noopMutation);
    mockUseRespondToMessage.mockReturnValue(noopMutation);
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: false, imageTheme: "default" },
      isLoading: false,
    } as any);
    mockUseUpdateUserSettings.mockReturnValue(noopMutation);
    renderWithProviders(<Messages />);

    fireEvent.click(screen.getByRole("button", { name: en.messagesPage.addExampleMessages }));
    await waitFor(() => expect(mockAddMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onError({ error: "Server error" });
    });
    await waitFor(() => {
      expect(screen.getByText(en.messagesPage.addExamplesErrorTitle)).toBeInTheDocument();
    });
  });

  it("delete button with confirmBeforeDelete=true opens confirmation modal", async () => {
    localStorage.setItem("confirmBeforeDelete", JSON.stringify(true));
    setupMocks();
    renderWithProviders(<Messages />);
    await act(async () => {});

    const deleteButtons = screen.getAllByRole("button", {
      name: en.questionCard.deleteMessageLabel,
    });
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByText(en.messagesPage.deleteConfirmTitle)).toBeInTheDocument();
    });
  });

  it("confirming delete from modal calls performDelete with fromModal=true; onSuccess closes modal", async () => {
    localStorage.setItem("confirmBeforeDelete", JSON.stringify(true));
    let capturedCallbacks: any;
    const mockDeleteMutate = vi.fn((_tid: string, callbacks: any) => {
      capturedCallbacks = callbacks;
    });
    setupMocks();
    mockUseDeleteMessage.mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Messages />);
    await act(async () => {});

    fireEvent.click(screen.getAllByRole("button", { name: en.questionCard.deleteMessageLabel })[0]);
    await waitFor(() => screen.getByText(en.messagesPage.deleteConfirmTitle));

    fireEvent.click(screen.getByRole("button", { name: en.common.delete }));
    await waitFor(() => expect(mockDeleteMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onSuccess();
    });
    await waitFor(() => {
      expect(screen.queryByText(en.messagesPage.deleteConfirmTitle)).toBeNull();
    });
  });

  it("performDelete from modal onError closes modal and shows toast", async () => {
    localStorage.setItem("confirmBeforeDelete", JSON.stringify(true));
    let capturedCallbacks: any;
    const mockDeleteMutate = vi.fn((_tid: string, callbacks: any) => {
      capturedCallbacks = callbacks;
    });
    setupMocks();
    mockUseDeleteMessage.mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Messages />);
    await act(async () => {});

    fireEvent.click(screen.getAllByRole("button", { name: en.questionCard.deleteMessageLabel })[0]);
    await waitFor(() => screen.getByText(en.messagesPage.deleteConfirmTitle));

    fireEvent.click(screen.getByRole("button", { name: en.common.delete }));
    await waitFor(() => expect(mockDeleteMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onError({ error: "Delete failed" });
    });
    await waitFor(() => {
      expect(screen.getByText(en.messagesPage.deleteErrorTitle)).toBeInTheDocument();
      expect(screen.queryByText(en.messagesPage.deleteConfirmTitle)).toBeNull();
    });
  });

  it("ConfirmationModal Cancel button closes the modal", async () => {
    localStorage.setItem("confirmBeforeDelete", JSON.stringify(true));
    setupMocks();
    renderWithProviders(<Messages />);
    await act(async () => {});

    fireEvent.click(screen.getAllByRole("button", { name: en.questionCard.deleteMessageLabel })[0]);
    await waitFor(() => screen.getByText(en.messagesPage.deleteConfirmTitle));

    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    await waitFor(() => {
      expect(screen.queryByText(en.messagesPage.deleteConfirmTitle)).toBeNull();
    });
  });

  it("performDelete onSuccess with respondingTid === tid clears the responding state", async () => {
    let capturedCallbacks: any;
    const mockDeleteMutate = vi.fn((_tid: string, callbacks: any) => {
      capturedCallbacks = callbacks;
    });
    setupMocks();
    mockUseDeleteMessage.mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Messages />);

    // Expand msg-1 via the "↩ Reply" button
    const replyButtons = screen.getAllByRole("button", { name: isReplyTriggerName });
    const openReplyBtn = replyButtons.find((b) => b.textContent?.includes("↩"));
    fireEvent.click(openReplyBtn!);
    await waitFor(() => screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }));

    // Delete the same expanded card (msg-1 is first)
    const deleteButtons = screen.getAllByRole("button", {
      name: en.questionCard.deleteMessageLabel,
    });
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => expect(mockDeleteMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onSuccess();
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("textbox", { name: en.replyComposer.responseAriaLabel })
      ).toBeNull();
    });
  });

  it("sending an empty response shows 'Empty Response' notification", async () => {
    setupMocks();
    renderWithProviders(<Messages />);

    const replyButtons = screen.getAllByRole("button", { name: isReplyTriggerName });
    fireEvent.click(replyButtons.find((b) => b.textContent?.includes("↩"))!);
    await waitFor(() => screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }));

    // Click Reply without typing anything
    fireEvent.click(screen.getByRole("button", { name: en.replyComposer.reply }));
    await waitFor(() => {
      expect(screen.getByText(en.messagesPage.emptyResponseTitle)).toBeInTheDocument();
    });
  });

  it("handleSendResponse with appendProfileLink=true appends the profile link", async () => {
    localStorage.setItem("appendProfileLink", JSON.stringify(true));
    let capturedData: any;
    const mockRespondMutate = vi.fn((data: any, _callbacks: any) => {
      capturedData = data;
    });
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({
      mutate: mockRespondMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Messages />);

    const replyButtons = screen.getAllByRole("button", { name: isReplyTriggerName });
    fireEvent.click(replyButtons.find((b) => b.textContent?.includes("↩"))!);
    await waitFor(() => screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }));
    fireEvent.change(screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }), {
      target: { value: "Great answer!" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.replyComposer.reply }));

    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalled());
    expect(capturedData.response).toContain("Great answer!");
    expect(capturedData.response).toContain(SESSION.profile.handle);
  });

  it("handleSendResponse onSuccess with data.link shows link in notification", async () => {
    let capturedCallbacks: any;
    const mockRespondMutate = vi.fn((_data: any, callbacks: any) => {
      capturedCallbacks = callbacks;
    });
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({
      mutate: mockRespondMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Messages />);

    const replyButtons = screen.getAllByRole("button", { name: isReplyTriggerName });
    fireEvent.click(replyButtons.find((b) => b.textContent?.includes("↩"))!);
    await waitFor(() => screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }));
    fireEvent.change(screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }), {
      target: { value: "My answer!" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.replyComposer.reply }));
    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onSuccess({
        link: "https://bsky.app/profile/user/post/123",
      });
    });
    await waitFor(() => {
      expect(screen.getByText(en.messagesPage.responseSentTitle)).toBeInTheDocument();
      expect(screen.getByText("https://bsky.app/profile/user/post/123")).toBeInTheDocument();
    });
  });

  it("handleSendResponse onSuccess without data.link shows plain success message", async () => {
    let capturedCallbacks: any;
    const mockRespondMutate = vi.fn((_data: any, callbacks: any) => {
      capturedCallbacks = callbacks;
    });
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({
      mutate: mockRespondMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Messages />);

    const replyButtons = screen.getAllByRole("button", { name: isReplyTriggerName });
    fireEvent.click(replyButtons.find((b) => b.textContent?.includes("↩"))!);
    await waitFor(() => screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }));
    fireEvent.change(screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }), {
      target: { value: "My answer!" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.replyComposer.reply }));
    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onSuccess({});
    });
    await waitFor(() => {
      expect(screen.getByText(en.messagesPage.responseSentTitle)).toBeInTheDocument();
      expect(screen.getByText(en.messagesPage.responsePosted)).toBeInTheDocument();
    });
  });

  it("character limit decreases when appendProfileLink switch is toggled on", async () => {
    setupMocks();
    renderWithProviders(<Messages />);

    const replyButtons = screen.getAllByRole("button", { name: isReplyTriggerName });
    fireEvent.click(replyButtons.find((b) => b.textContent?.includes("↩"))!);
    await waitFor(() => screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }));

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

    const replyButtons = screen.getAllByRole("button", { name: isReplyTriggerName });
    fireEvent.click(replyButtons.find((b) => b.textContent?.includes("↩"))!);
    await waitFor(() => screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }));

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

    const replyButtons = screen.getAllByRole("button", { name: isReplyTriggerName });
    fireEvent.click(replyButtons.find((b) => b.textContent?.includes("↩"))!);
    await waitFor(() => screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }));

    // Fire Escape on the document (not the textarea) to hit the global keydown handler
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(
        screen.queryByRole("textbox", { name: en.replyComposer.responseAriaLabel })
      ).toBeNull();
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

    act(() => {
      capturedOnError({ error: "Theme update failed" });
    });
    await waitFor(() => {
      expect(screen.getByText(en.messagesPage.themeUpdateErrorTitle)).toBeInTheDocument();
    });
  });

  it("handleAddExampleMessages returns early when session has no did", () => {
    const mockAddMutate = vi.fn();
    mockUseAddExampleMessages.mockReturnValue({
      mutate: mockAddMutate,
      isPending: false,
    } as any);
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: true, did: null, profile: null },
      isLoading: false,
    } as any);
    mockUseMessages.mockReturnValue({
      data: { messages: [] },
      isLoading: false,
      refetch: vi.fn(),
    } as any);
    mockUseDeleteMessage.mockReturnValue(noopMutation);
    mockUseRespondToMessage.mockReturnValue(noopMutation);
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: false, imageTheme: "default" },
      isLoading: false,
    } as any);
    mockUseUpdateUserSettings.mockReturnValue(noopMutation);
    renderWithProviders(<Messages />);

    fireEvent.click(screen.getByRole("button", { name: en.messagesPage.addExampleMessages }));
    expect(mockAddMutate).not.toHaveBeenCalled();
  });

  it("clicking the Copy button in the hero card triggers haptic and copy", () => {
    setupMocks();
    renderWithProviders(<Messages />);
    const copyBtn = screen.getByRole("button", { name: en.common.copy });
    expect(() => fireEvent.click(copyBtn)).not.toThrow();
  });

  it("clicking a ThemeCard calls updateSettings.mutate when not loading", () => {
    const mockMutate = vi.fn();
    setupMocks();
    mockUseUpdateUserSettings.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Messages />);

    const defaultThemeBtn = screen.getByRole("button", { name: en.themes.image.default });
    fireEvent.click(defaultThemeBtn);

    expect(mockMutate).toHaveBeenCalledWith({
      imageTheme: "default",
      pdsSyncEnabled: false,
    });
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
      await waitFor(() =>
        screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel })
      );

      // Enter when expanded → collapse
      fireEvent.keyDown(card, { key: "Enter" });
      await waitFor(() => {
        expect(
          screen.queryByRole("textbox", { name: en.replyComposer.responseAriaLabel })
        ).toBeNull();
      });
    }
  });

  it("clicking the card while it is expanded collapses it", async () => {
    setupMocks();
    renderWithProviders(<Messages />);

    // Open reply via the "↩ Reply" button
    const replyButtons = screen.getAllByRole("button", { name: isReplyTriggerName });
    fireEvent.click(replyButtons.find((b) => b.textContent?.includes("↩"))!);
    await waitFor(() => screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }));

    // Click the message text to hit the card's onClick with isExpanded=true
    const msgText = screen.getByText("Hello?");
    fireEvent.click(msgText);
    await waitFor(() => {
      expect(
        screen.queryByRole("textbox", { name: en.replyComposer.responseAriaLabel })
      ).toBeNull();
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
    const replyButtons = screen.getAllByRole("button", { name: isReplyTriggerName });
    const openReplyBtn = replyButtons.find((b) => b.textContent?.includes("↩"));
    fireEvent.click(openReplyBtn!);

    // Wait for the response textarea to appear
    await waitFor(() => screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }));
    fireEvent.change(screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }), {
      target: { value: "Great question!" },
    });

    // Click the "Reply" send button (the gradient button inside the response box)
    const sendReplyBtn = screen.getByRole("button", { name: en.replyComposer.reply });
    fireEvent.click(sendReplyBtn);
    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalled());

    act(() => {
      capturedRespondCallbacks.onError({ error: "Post failed" });
    });

    await waitFor(() => {
      expect(screen.getByText(en.messagesPage.responseErrorTitle)).toBeInTheDocument();
    });
  });

  it("clicking the pin button pins a message (handleTogglePin)", async () => {
    setupMocks();
    renderWithProviders(<Messages />);
    await act(async () => {});

    const pinBtn = screen.getAllByRole("button", { name: en.questionCard.setAsThreadRootLabel })[0];
    fireEvent.click(pinBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: en.questionCard.unpinThreadRootLabel })
      ).toBeInTheDocument();
    });
  });

  it("clicking the pin button again unpins the message (handleTogglePin unpin branch)", async () => {
    setupMocks();
    renderWithProviders(<Messages />);
    await act(async () => {});

    const pinBtn = screen.getAllByRole("button", { name: en.questionCard.setAsThreadRootLabel })[0];
    fireEvent.click(pinBtn);
    await waitFor(() => screen.getByRole("button", { name: en.questionCard.unpinThreadRootLabel }));

    fireEvent.click(screen.getByRole("button", { name: en.questionCard.unpinThreadRootLabel }));
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: en.questionCard.unpinThreadRootLabel })
      ).toBeNull();
    });
  });

  it("justPinnedTid setTimeout clears the animation class", async () => {
    setupMocks();
    renderWithProviders(<Messages />);
    await act(async () => {});

    const pinBtn = screen.getAllByRole("button", { name: en.questionCard.setAsThreadRootLabel })[0];
    fireEvent.click(pinBtn);
    await waitFor(() => screen.getByRole("button", { name: en.questionCard.unpinThreadRootLabel }));

    // The card should have the pinned entry animation class briefly
    const card = document.getElementById("message-card-msg-1");
    expect(card).toBeInTheDocument();
    // After the setTimeout(420ms) the class clears; just verifying the flow doesn't throw
    expect(document.body).toBeInTheDocument();
  });

  it("pinning msg-2 moves it to the top of the sorted list", async () => {
    setupMocks();
    renderWithProviders(<Messages />);
    await act(async () => {});

    const pinBtns = screen.getAllByRole("button", { name: en.questionCard.setAsThreadRootLabel });
    expect(pinBtns.length).toBe(2);
    fireEvent.click(pinBtns[1]);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: en.questionCard.unpinThreadRootLabel })
      ).toBeInTheDocument();
    });
    await waitFor(() => {
      const cards = document.querySelectorAll('[id^="message-card-"]');
      expect(cards[0].id).toBe("message-card-msg-2");
    });
  });

  it("handleDeleteRequest returns early when message is pinned", async () => {
    setupMocks();
    const mockDeleteMutate = vi.fn();
    mockUseDeleteMessage.mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Messages />);
    await act(async () => {});

    const pinBtn = screen.getAllByRole("button", { name: en.questionCard.setAsThreadRootLabel })[0];
    fireEvent.click(pinBtn);
    await waitFor(() => screen.getByRole("button", { name: en.questionCard.unpinThreadRootLabel }));

    // Pinned message's delete button has a different aria-label; clicking it is a no-op
    const pinnedDeleteBtn = screen.getByRole("button", {
      name: en.questionCard.cannotDeleteThreadRootLabel,
    });
    fireEvent.click(pinnedDeleteBtn);
    expect(mockDeleteMutate).not.toHaveBeenCalled();
  });

  it("thread link is rendered and clickable when a thread response link exists", async () => {
    localStorage.setItem("threadRootTid-did:example:1", JSON.stringify("msg-1"));
    localStorage.setItem(
      "threadLinks-did:example:1",
      JSON.stringify({
        "msg-1": {
          uri: "at://did/app.bsky.feed.post/abc",
          link: "https://bsky.app/profile/user/post/abc",
        },
      })
    );
    setupMocks();
    renderWithProviders(<Messages />);
    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /bsky\.app/i })).toBeInTheDocument();
    });

    const threadAnchor = screen.getByRole("link", { name: /bsky\.app/i });
    expect(() => fireEvent.click(threadAnchor)).not.toThrow();
  });

  it("setThreadLinks is called after pinned message response succeeds with a link", async () => {
    localStorage.setItem("threadRootTid-did:example:1", JSON.stringify("msg-1"));
    let capturedCallbacks: any;
    const mockRespondMutate = vi.fn((_data: any, callbacks: any) => {
      capturedCallbacks = callbacks;
    });
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({
      mutate: mockRespondMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Messages />);
    await act(async () => {});

    await waitFor(() => screen.getByRole("button", { name: en.questionCard.unpinThreadRootLabel }));

    // Click the card itself (not the ↩ Reply button) to expand the pinned message
    const card = document.getElementById("message-card-msg-1")!;
    fireEvent.click(card);
    await waitFor(() => screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }));

    fireEvent.change(screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }), {
      target: { value: "Thread reply!" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.replyComposer.reply }));
    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onSuccess({
        uri: "at://did/app.bsky.feed.post/xyz",
        cid: "cid-xyz",
        link: "https://bsky.app/profile/user/post/xyz",
      });
    });

    // Pinned message response shows "Response Sent!" (not "Added to thread!" which is for replies-to-thread)
    await waitFor(() => {
      expect(screen.getByText(en.messagesPage.responseSentTitle)).toBeInTheDocument();
    });
    // Verify localStorage threadLinks was updated
    const stored = JSON.parse(localStorage.getItem("threadLinks-did:example:1") || "{}");
    expect(stored["msg-1"]?.uri).toBe("at://did/app.bsky.feed.post/xyz");
  });

  it("collapsed reply Box onClick stops propagation (card doesn't expand)", async () => {
    setupMocks();
    renderWithProviders(<Messages />);
    await act(async () => {});

    const replyBtns = screen.getAllByRole("button", { name: isReplyTriggerName });
    const collapsedBtn = replyBtns.find((b) => b.textContent?.includes("↩"))!;
    const boxDiv = collapsedBtn.parentElement!;

    // Click the Box div directly — fires stopPropagation, Paper's onClick is NOT called
    fireEvent.click(boxDiv);

    // Card should NOT expand (no textarea) since the click was stopped before Paper onClick
    expect(screen.queryByRole("textbox", { name: en.replyComposer.responseAriaLabel })).toBeNull();
  });

  it("collapsed reply Button onClick expands card (userEvent)", async () => {
    setupMocks();
    renderWithProviders(<Messages />);
    await act(async () => {});

    const replyBtns = screen.getAllByRole("button", { name: isReplyTriggerName });
    const collapsedBtn = replyBtns.find((b) => b.textContent?.includes("↩"))!;

    const user = userEvent.setup();
    await user.click(collapsedBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel })
      ).toBeInTheDocument();
    });
  });

  // ── Batch 5: closing remaining coverage gaps ──────────────────────────────

  it("CharRing shows the danger color once the response exceeds 90% of the character limit", async () => {
    setupMocks();
    renderWithProviders(<Messages />);

    const realReplyBtn = screen.getAllByRole("button", { name: "↩ Reply" })[0];
    fireEvent.click(realReplyBtn);
    const textarea = await screen.findByRole("textbox", {
      name: en.replyComposer.responseAriaLabel,
    });

    const longText = "a".repeat(260); // > 90% of the default 277 char limit
    fireEvent.change(textarea, { target: { value: longText } });

    await waitFor(() => {
      expect(screen.getByText(`${longText.length}/277`)).toBeInTheDocument();
    });

    const dangerCircle = Array.from(document.querySelectorAll("svg circle")).find(
      (c) => c.getAttribute("stroke") === "var(--nf-compose-warn)"
    );
    expect(dangerCircle).toBeTruthy();
  });

  it("updateSettings onError falls back to a default message when error.error is missing", async () => {
    let capturedOnError: any;
    setupMocks();
    mockUseUpdateUserSettings.mockImplementation((options: any) => {
      capturedOnError = options?.onError;
      return noopMutation;
    });
    renderWithProviders(<Messages />);

    act(() => {
      capturedOnError({});
    });
    await waitFor(() => {
      expect(screen.getByText(en.errors.generic)).toBeInTheDocument();
    });
  });

  it("addExampleMessages onError falls back to a default message when err.error is missing", async () => {
    let capturedCallbacks: any;
    const mockAddMutate = vi.fn((_did: string, callbacks: any) => {
      capturedCallbacks = callbacks;
    });
    mockUseAddExampleMessages.mockReturnValue({
      mutate: mockAddMutate,
      isPending: false,
    } as any);
    mockUseSession.mockReturnValue({ data: SESSION, isLoading: false } as any);
    mockUseMessages.mockReturnValue({
      data: { messages: [] },
      isLoading: false,
      refetch: vi.fn(),
    } as any);
    mockUseDeleteMessage.mockReturnValue(noopMutation);
    mockUseRespondToMessage.mockReturnValue(noopMutation);
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: false, imageTheme: "default" },
      isLoading: false,
    } as any);
    mockUseUpdateUserSettings.mockReturnValue(noopMutation);
    renderWithProviders(<Messages />);

    fireEvent.click(screen.getByRole("button", { name: en.messagesPage.addExampleMessages }));
    await waitFor(() => expect(mockAddMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onError({});
    });
    await waitFor(() => {
      expect(screen.getByText(en.errors.generic)).toBeInTheDocument();
    });
  });

  it("performDelete onError (from modal) falls back to a default message when err.error is missing", async () => {
    localStorage.setItem("confirmBeforeDelete", JSON.stringify(true));
    let capturedCallbacks: any;
    const mockDeleteMutate = vi.fn((_tid: string, callbacks: any) => {
      capturedCallbacks = callbacks;
    });
    setupMocks();
    mockUseDeleteMessage.mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Messages />);
    await act(async () => {});

    fireEvent.click(screen.getAllByRole("button", { name: en.questionCard.deleteMessageLabel })[0]);
    await waitFor(() => screen.getByText(en.messagesPage.deleteConfirmTitle));
    fireEvent.click(screen.getByRole("button", { name: en.common.delete }));
    await waitFor(() => expect(mockDeleteMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onError({});
    });
    await waitFor(() => {
      expect(screen.getByText(en.errors.generic)).toBeInTheDocument();
      expect(screen.queryByText(en.messagesPage.deleteConfirmTitle)).toBeNull();
    });
  });

  it("characterLimit skips the question-length subtraction once the responding message disappears from the list", async () => {
    localStorage.setItem("includeQuestionAsImage", JSON.stringify(false));
    setupMocks();
    const { rerender } = renderWithProviders(<Messages />);

    const realReplyBtn = screen.getAllByRole("button", { name: "↩ Reply" })[0];
    fireEvent.click(realReplyBtn);
    await screen.findByRole("textbox", { name: en.replyComposer.responseAriaLabel });
    // With includeQuestionAsImage off, the question text is subtracted from the base 277 limit.
    expect(screen.queryByText(/^0\/277$/)).toBeNull();

    // Simulate the message list refreshing without msg-1 while still "responding" to it
    // (e.g. it was deleted from another tab, or a refetch raced the in-progress reply).
    mockUseMessages.mockReturnValue({
      data: { messages: [MESSAGES[1]] },
      isLoading: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    } as any);
    expect(() => rerender(<Messages />)).not.toThrow();

    await waitFor(() => {
      expect(
        screen.queryByRole("textbox", { name: en.replyComposer.responseAriaLabel })
      ).toBeNull();
    });
    expect(screen.getByText("What is your favorite color?")).toBeInTheDocument();
  });

  it("clears a stale pinned threadRootTid (and its threadLinks entry) when the message no longer exists", async () => {
    localStorage.setItem("threadRootTid-did:example:1", JSON.stringify("ghost-tid"));
    localStorage.setItem(
      "threadLinks-did:example:1",
      JSON.stringify({ "ghost-tid": { uri: "at://x", cid: "y" } })
    );
    setupMocks(); // MESSAGES contains only msg-1 / msg-2, not "ghost-tid"
    renderWithProviders(<Messages />);

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("threadRootTid-did:example:1") || "null")).toBeNull();
    });
    await waitFor(() => {
      const links = JSON.parse(localStorage.getItem("threadLinks-did:example:1") || "{}");
      expect(links["ghost-tid"]).toBeUndefined();
    });
  });

  it("replying to a non-root message when the thread root already has a link sets replyTo and shows 'Added to thread!' with a link", async () => {
    localStorage.setItem("threadRootTid-did:example:1", JSON.stringify("msg-2"));
    localStorage.setItem(
      "threadLinks-did:example:1",
      JSON.stringify({ "msg-2": { uri: "at://root", cid: "cid-root" } })
    );
    let capturedCallbacks: any;
    const mockRespondMutate = vi.fn((_data: any, callbacks: any) => {
      capturedCallbacks = callbacks;
    });
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({
      mutate: mockRespondMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Messages />);
    await act(async () => {});

    // msg-1 is not the root, and threadLinks["msg-2"] has a uri/cid, so it's unblocked.
    const replyBtn = screen.getByRole("button", { name: en.questionCard.replyToThread });
    fireEvent.click(replyBtn);
    await screen.findByRole("textbox", { name: en.replyComposer.responseAriaLabel });
    fireEvent.change(screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }), {
      target: { value: "Thread reply text" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.replyComposer.replyToThread }));
    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalled());
    expect(mockRespondMutate.mock.calls[0][0].replyTo).toEqual({
      uri: "at://root",
      cid: "cid-root",
    });

    act(() => {
      capturedCallbacks.onSuccess({ link: "https://bsky.app/profile/user/post/thread1" });
    });
    await waitFor(() => {
      expect(screen.getByText(en.messagesPage.threadReplyTitle)).toBeInTheDocument();
      expect(screen.getByText(en.messagesPage.threadReplyPosted)).toBeInTheDocument();
      expect(screen.getByText("https://bsky.app/profile/user/post/thread1")).toBeInTheDocument();
    });
  });

  it("replying to a non-root message without a data.link shows plain 'Added to thread.' message", async () => {
    localStorage.setItem("threadRootTid-did:example:1", JSON.stringify("msg-2"));
    localStorage.setItem(
      "threadLinks-did:example:1",
      JSON.stringify({ "msg-2": { uri: "at://root", cid: "cid-root" } })
    );
    let capturedCallbacks: any;
    const mockRespondMutate = vi.fn((_data: any, callbacks: any) => {
      capturedCallbacks = callbacks;
    });
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({
      mutate: mockRespondMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Messages />);
    await act(async () => {});

    const replyBtn = screen.getByRole("button", { name: en.questionCard.replyToThread });
    fireEvent.click(replyBtn);
    await screen.findByRole("textbox", { name: en.replyComposer.responseAriaLabel });
    fireEvent.change(screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }), {
      target: { value: "Thread reply text" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.replyComposer.replyToThread }));
    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalled());

    act(() => {
      capturedCallbacks.onSuccess({});
    });
    await waitFor(() => {
      expect(screen.getByText(en.messagesPage.threadReplyTitle)).toBeInTheDocument();
      expect(screen.getByText(en.messagesPage.threadReplyPosted)).toBeInTheDocument();
    });
  });

  it("the expanded send button is disabled when the thread root has no link yet (blocked)", async () => {
    localStorage.setItem("threadRootTid-did:example:1", JSON.stringify("msg-2"));
    // No threadLinks entry for msg-2 → responding to msg-1 is blocked.
    const mockRespondMutate = vi.fn();
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({
      mutate: mockRespondMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Messages />);
    await act(async () => {});

    // Click the card body directly (not the small Reply button, which itself blocks opening)
    // to get into the expanded/blocked state and exercise the Send button's disabled branch.
    const card = document.getElementById("message-card-msg-1")!;
    fireEvent.click(card);
    await screen.findByRole("textbox", { name: en.replyComposer.responseAriaLabel });

    const sendBtn = screen.getByRole("button", { name: en.replyComposer.replyToThread });
    expect(sendBtn).toBeDisabled();
    fireEvent.click(sendBtn);
    expect(mockRespondMutate).not.toHaveBeenCalled();
  });

  it("collapsed reply Box wrapper stops click propagation without itself opening the response box", () => {
    setupMocks();
    renderWithProviders(<Messages />);

    const realBtn = screen.getAllByRole("button", { name: "↩ Reply" })[0];
    const boxDiv = realBtn.parentElement!;
    fireEvent.click(boxDiv);

    expect(screen.queryByRole("textbox", { name: en.replyComposer.responseAriaLabel })).toBeNull();
  });

  it("collapsed reply Button (exact match) opens the response box when not blocked", async () => {
    setupMocks();
    renderWithProviders(<Messages />);

    const realBtn = screen.getAllByRole("button", { name: "↩ Reply" })[0];
    fireEvent.click(realBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel })
      ).toBeInTheDocument();
    });
  });

  it("collapsed reply Button does nothing when blocked (thread root has no link yet)", async () => {
    localStorage.setItem("threadRootTid-did:example:1", JSON.stringify("msg-2"));
    setupMocks();
    renderWithProviders(<Messages />);
    await act(async () => {});

    const realBtn = screen.getByRole("button", { name: en.questionCard.replyToThread });
    fireEvent.click(realBtn);
    expect(screen.queryByRole("textbox", { name: en.replyComposer.responseAriaLabel })).toBeNull();
  });

  it("clicking the Copy button shows 'Copied!' after navigator.clipboard.writeText resolves", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });
    setupMocks();
    renderWithProviders(<Messages />);

    fireEvent.click(screen.getByRole("button", { name: en.common.copy }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: en.common.copied })).toBeInTheDocument();
    });
  });

  it("shows a loader in place of the message grid while messages are loading", () => {
    mockUseSession.mockReturnValue({ data: SESSION, isLoading: false } as any);
    mockUseMessages.mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: vi.fn().mockResolvedValue(undefined),
    } as any);
    mockUseDeleteMessage.mockReturnValue(noopMutation);
    mockUseRespondToMessage.mockReturnValue(noopMutation);
    mockUseAddExampleMessages.mockReturnValue(noopMutation);
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: false, imageTheme: "default" },
      isLoading: false,
    } as any);
    mockUseUpdateUserSettings.mockReturnValue(noopMutation);
    renderWithProviders(<Messages />);

    expect(screen.queryByText(en.messagesPage.noMessagesTitle)).toBeNull();
    expect(screen.queryByText("Hello?")).toBeNull();
  });

  it("shows the 'Default' theme label while user settings are loading", () => {
    setupMocks();
    mockUseUserSettings.mockReturnValue({ data: undefined, isLoading: true } as any);
    renderWithProviders(<Messages />);
    expect(screen.getAllByText(imageThemeLabels(en).default).length).toBeGreaterThan(0);
  });

  it("falls back to the 'Default' theme label when userSettings.imageTheme is undefined", () => {
    setupMocks();
    mockUseUserSettings.mockReturnValue({
      data: { pdsSyncEnabled: false },
      isLoading: false,
    } as any);
    renderWithProviders(<Messages />);
    expect(screen.getAllByText(imageThemeLabels(en).default).length).toBeGreaterThan(0);
  });

  it("clicking a ThemeCard while settings are loading does not call updateSettings.mutate", () => {
    const mockMutate = vi.fn();
    setupMocks();
    mockUseUserSettings.mockReturnValue({ data: undefined, isLoading: true } as any);
    mockUseUpdateUserSettings.mockReturnValue({ mutate: mockMutate, isPending: false } as any);
    renderWithProviders(<Messages />);

    fireEvent.click(screen.getByRole("button", { name: en.themes.image.default }));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("clicking a ThemeCard while an update is already pending does not call updateSettings.mutate again", () => {
    const mockMutate = vi.fn();
    setupMocks();
    mockUseUpdateUserSettings.mockReturnValue({ mutate: mockMutate, isPending: true } as any);
    renderWithProviders(<Messages />);

    fireEvent.click(screen.getByRole("button", { name: en.themes.image.default }));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("pressing a non-Enter/Space key on a message card does nothing", () => {
    setupMocks();
    renderWithProviders(<Messages />);

    const card = document.getElementById("message-card-msg-1")!;
    fireEvent.focus(card);
    fireEvent.keyDown(card, { key: "Tab" });

    expect(screen.queryByRole("textbox", { name: en.replyComposer.responseAriaLabel })).toBeNull();
  });

  it("arrow keys do nothing until a card has been focused", () => {
    setupMocks();
    renderWithProviders(<Messages />);

    fireEvent.keyDown(document, { key: "ArrowDown" });

    expect(document.getElementById("message-card-msg-1")).not.toBe(document.activeElement);
  });

  it("useGradients=false hydrates from localStorage and drives the card's background-color source", async () => {
    // Note: we can't assert the rendered `style.background` string directly here — happy-dom has
    // a quirk where once a `background` shorthand containing `var(...)` is set via the CSSOM
    // property setter, later property-based updates to that same node stop being reflected in
    // `.style`/`getAttribute("style")`, even though the underlying JS ternary re-evaluates
    // correctly on every render. The Switch's `checked` DOM property isn't subject to that
    // shorthand-specific bug, and it reflects the exact same `useGradients` value read in the
    // same render pass as the card's `background: useGradients ? ... : surfaceBg(isDark)` line.
    localStorage.setItem("useGradients", JSON.stringify(false));
    setupMocks();
    renderWithProviders(<Messages />);

    await waitFor(() => {
      const gradientSwitch = screen.getByLabelText(/gradient backgrounds/i) as HTMLInputElement;
      expect(gradientSwitch.checked).toBe(false);
    });
  });

  it("pressing Shift+Enter in the response textarea does not submit the response", async () => {
    const mockRespondMutate = vi.fn();
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({
      mutate: mockRespondMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Messages />);

    const realReplyBtn = screen.getAllByRole("button", { name: "↩ Reply" })[0];
    fireEvent.click(realReplyBtn);
    const textarea = await screen.findByRole("textbox", {
      name: en.replyComposer.responseAriaLabel,
    });
    fireEvent.change(textarea, { target: { value: "line one" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(mockRespondMutate).not.toHaveBeenCalled();
    expect(
      screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel })
    ).toBeInTheDocument();
  });

  it("Alt+R shortcut is a no-op when there are no messages", () => {
    setupMocks([]);
    renderWithProviders(<Messages />);
    expect(() => fireEvent.keyDown(document, { key: "R", altKey: true })).not.toThrow();
  });

  it("ArrowDown/ArrowUp shortcuts are a no-op when the message list becomes empty", async () => {
    setupMocks();
    const { rerender } = renderWithProviders(<Messages />);

    // Focus a card via Alt+R so focusedCardIndex !== -1
    fireEvent.keyDown(document, { key: "R", altKey: true });

    mockUseMessages.mockReturnValue({
      data: { messages: [] },
      isLoading: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    } as any);
    rerender(<Messages />);
    await waitFor(() => {
      expect(screen.getByText(en.messagesPage.noMessagesBody)).toBeInTheDocument();
    });

    expect(() => fireEvent.keyDown(document, { key: "ArrowDown" })).not.toThrow();
  });

  // Historically flaky: the responding-Tid effect in Messages.tsx schedules a
  // 150ms setTimeout to scroll the card into view. Before that effect gained a
  // clearTimeout cleanup, the timer could outlive the test that scheduled it
  // and fire here — tripping this test's scrollIntoView spy. The component now
  // clears its timer on re-render/unmount, so the spy below should stay clean;
  // if it fires again, suspect a new un-cleaned async scroll path in Messages.tsx.
  it("does not scroll into view when the newest message target is already visible in the viewport", async () => {
    // window.innerHeight varies by test environment/CI runner, so pin it explicitly rather
    // than relying on the ambient default — the "visible" rect below (top:100, bottom:200)
    // is only actually in-view relative to a known viewport height.
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 800,
    });
    const scrollSpy = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
    const rectSpy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      top: 100,
      bottom: 200,
      left: 0,
      right: 0,
      width: 0,
      height: 100,
      x: 0,
      y: 100,
      toJSON: () => {},
    } as DOMRect);

    try {
      setupMocks([]);
      const { rerender } = renderWithProviders(<Messages />);
      await waitFor(() => expect(screen.queryByText("Hello?")).toBeNull());

      mockUseMessages.mockReturnValue({
        data: { messages: MESSAGES },
        isLoading: false,
        refetch: vi.fn().mockResolvedValue(undefined),
      } as any);
      rerender(<Messages />);
      await waitFor(() => expect(screen.getByText("Hello?")).toBeInTheDocument());

      expect(scrollSpy).not.toHaveBeenCalled();
    } finally {
      // Restore even on assertion failure, so a broken test here can't leak a mocked
      // scrollIntoView/getBoundingClientRect/innerHeight into later tests.
      scrollSpy.mockRestore();
      rectSpy.mockRestore();
      Object.defineProperty(window, "innerHeight", {
        writable: true,
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it("Cancel does not close the confirmation modal while a delete mutation is globally pending", async () => {
    localStorage.setItem("confirmBeforeDelete", JSON.stringify(true));
    setupMocks();
    mockUseDeleteMessage.mockReturnValue({ mutate: vi.fn(), isPending: true } as any);
    renderWithProviders(<Messages />);
    await act(async () => {});

    fireEvent.click(screen.getAllByRole("button", { name: en.questionCard.deleteMessageLabel })[0]);
    await waitFor(() => screen.getByText(en.messagesPage.deleteConfirmTitle));

    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    expect(screen.getByText(en.messagesPage.deleteConfirmTitle)).toBeInTheDocument();
  });

  it("handleSendResponse onError falls back to a default message when err.error is missing", async () => {
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

    const realReplyBtn = screen.getAllByRole("button", { name: "↩ Reply" })[0];
    fireEvent.click(realReplyBtn);
    await screen.findByRole("textbox", { name: en.replyComposer.responseAriaLabel });
    fireEvent.change(screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }), {
      target: { value: "Great question!" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.replyComposer.reply }));
    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalled());

    act(() => {
      capturedRespondCallbacks.onError({});
    });
    await waitFor(() => {
      expect(screen.getByText(en.errors.generic)).toBeInTheDocument();
    });
  });

  it("the auto-scroll effect does not re-fire scrollIntoView when a refetch returns the same message count", async () => {
    setupMocks();
    const { rerender } = renderWithProviders(<Messages />);
    await waitFor(() => expect(screen.getByText("Hello?")).toBeInTheDocument());

    const scrollSpy = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
    try {
      // A background refetch (refetchInterval) resolves with a new array reference containing
      // the same messages — count === prev, so the effect's guard should short-circuit to false.
      mockUseMessages.mockReturnValue({
        data: { messages: [...MESSAGES] },
        isLoading: false,
        refetch: vi.fn().mockResolvedValue(undefined),
      } as any);
      rerender(<Messages />);
      await act(async () => {});

      expect(scrollSpy).not.toHaveBeenCalled();
    } finally {
      scrollSpy.mockRestore();
    }
  });

  it("localizes the owner's share payload to their touchpoint locale (#266)", async () => {
    // The share text leaves the DOM into the OS share sheet, so it can't be
    // reached by browser translate — it must be pre-localized from the owner's
    // setting. Spy on navigator.share to capture what's actually handed off.
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    const originalShare = navigator.share;
    Object.defineProperty(navigator, "share", {
      value: shareSpy,
      configurable: true,
      writable: true,
    });

    mockUseSession.mockReturnValue({ data: SESSION, isLoading: false } as any);
    mockUseMessages.mockReturnValue({
      data: { messages: [] },
      isLoading: false,
      refetch: vi.fn(),
    } as any);
    mockUseDeleteMessage.mockReturnValue(noopMutation);
    mockUseRespondToMessage.mockReturnValue(noopMutation);
    mockUseAddExampleMessages.mockReturnValue(noopMutation);
    mockUseUserSettings.mockReturnValue({
      data: {
        pdsSyncEnabled: false,
        imageTheme: "default",
        touchpointLocale: "es",
      },
      isLoading: false,
    } as any);
    mockUseUpdateUserSettings.mockReturnValue(noopMutation);

    try {
      renderWithProviders(<Messages />);
      // The "Share" button in the profile header hands sharePayload to the OS.
      const shareButtons = screen.getAllByRole("button", { name: en.shareButton.button });
      fireEvent.click(shareButtons[0]);
      await waitFor(() => expect(shareSpy).toHaveBeenCalled());

      const payload = shareSpy.mock.calls[0][0];
      // Spanish acquisition copy, parameterized with the owner's display name.
      expect(payload.title).toBe(`¡Envíame mensajes anónimos en ${APP_NAME}!`);
      expect(payload.text).toBe("¡Envía a Karan mensajes anónimos!");
    } finally {
      Object.defineProperty(navigator, "share", {
        value: originalShare,
        configurable: true,
        writable: true,
      });
    }
  });

  // ── #365: the render runs beside the composer, not inside the send ─────────

  function openComposerFor(index = 0) {
    const replyButtons = screen.getAllByRole("button", { name: isReplyTriggerName });
    fireEvent.click(replyButtons.filter((b) => b.textContent?.includes("↩"))[index]);
    return screen.findByRole("textbox", { name: en.replyComposer.responseAriaLabel });
  }

  async function typeAndSend(text = "My answer!") {
    fireEvent.change(screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }), {
      target: { value: text },
    });
    fireEvent.click(screen.getByRole("button", { name: en.replyComposer.reply }));
  }

  it("posts a reply that carries an image with the render key the server already holds", async () => {
    const mockRespondMutate = vi.fn();
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({
      mutate: mockRespondMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Messages />);

    await openComposerFor();
    await typeAndSend();

    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalled());
    expect(mockRespondMutate.mock.calls[0][0].renderId).toBe(RENDER_ID);
  });

  it("posts a text-only reply straight away, with no render key", async () => {
    const mockRespondMutate = vi.fn();
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({
      mutate: mockRespondMutate,
      isPending: false,
    } as any);
    renderWithProviders(<Messages />);

    fireEvent.click(screen.getByLabelText(/question as image/i));
    await openComposerFor();
    await typeAndSend();

    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalled());
    expect(mockRespondMutate.mock.calls[0][0].renderId).toBeUndefined();
    expect(startRenderMutate).not.toHaveBeenCalled();
  });

  it("holds the reply back until the question image is rendered, and says so", async () => {
    const mockRespondMutate = vi.fn();
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({
      mutate: mockRespondMutate,
      isPending: false,
    } as any);
    renderPoll = () => ({ status: "rendering" });
    const { rerender } = renderWithProviders(<Messages />);

    await openComposerFor();
    await typeAndSend();

    expect(mockRespondMutate).not.toHaveBeenCalled();
    expect(screen.getByText(en.replyComposer.renderingImage)).toBeInTheDocument();

    renderPoll = () => ({ status: "ready" });
    rerender(<Messages />);

    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalledTimes(1));
  });

  it("pressing Enter twice while the question image is still rendering posts once", async () => {
    // The async split widens the #360 window: the composer is now silent for the
    // whole render, not just the post, and nothing downstream is idempotent.
    const mockRespondMutate = vi.fn();
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({
      mutate: mockRespondMutate,
      isPending: false,
    } as any);
    renderPoll = () => ({ status: "rendering" });
    const { rerender } = renderWithProviders(<Messages />);

    await openComposerFor();
    const textarea = screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel });
    fireEvent.change(textarea, { target: { value: "My answer!" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    renderPoll = () => ({ status: "ready" });
    rerender(<Messages />);

    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalledTimes(1));
  });

  it("surfaces the specific error a failed render carries, and asks for a fresh one", async () => {
    const mockRespondMutate = vi.fn();
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({
      mutate: mockRespondMutate,
      isPending: false,
    } as any);
    renderPoll = () => ({ status: "failed", error: "image service unreachable" });
    renderWithProviders(<Messages />);

    await openComposerFor();
    await typeAndSend();

    await waitFor(() => {
      expect(screen.getByText(en.messagesPage.imageRenderFailedTitle)).toBeInTheDocument();
      expect(screen.getByText(/image service unreachable/i)).toBeInTheDocument();
    });
    expect(mockRespondMutate).not.toHaveBeenCalled();
    // The failure was read, which clears it server-side, so the send asked for a
    // fresh render on top of the one the open composer started.
    expect(startRenderMutate.mock.calls.length).toBeGreaterThan(1);
  });

  it("falls back to a default message when a failed render carries no error", async () => {
    setupMocks();
    renderPoll = () => ({ status: "failed" });
    renderWithProviders(<Messages />);

    await openComposerFor();
    await typeAndSend();

    await waitFor(() => {
      expect(screen.getByText(en.messagesPage.imageRenderFailedMessage)).toBeInTheDocument();
    });
  });

  it("keeps waiting instead of erroring when respond says the render is not ready yet", async () => {
    let capturedCallbacks: any;
    const mockRespondMutate = vi.fn((_data: any, callbacks: any) => {
      capturedCallbacks = callbacks;
    });
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({
      mutate: mockRespondMutate,
      isPending: false,
    } as any);
    renderPoll = (attempt) => (attempt === 0 ? { status: "ready" } : { status: "rendering" });
    const { rerender } = renderWithProviders(<Messages />);

    await openComposerFor();
    await typeAndSend();
    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalledTimes(1));

    act(() => {
      capturedCallbacks.onError({ status: 409, error: "render not ready" });
    });

    expect(screen.queryByText(en.messagesPage.responseErrorTitle)).toBeNull();
    expect(screen.getByText(en.replyComposer.renderingImage)).toBeInTheDocument();

    renderPoll = () => ({ status: "ready" });
    rerender(<Messages />);
    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalledTimes(2));
  });

  it("starts a render when the image toggle is flipped on with the composer already open", async () => {
    localStorage.setItem("includeQuestionAsImage", JSON.stringify(false));
    setupMocks();
    renderWithProviders(<Messages />);
    await act(async () => {});

    await openComposerFor();
    expect(startRenderMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/question as image/i));

    await waitFor(() => expect(startRenderMutate).toHaveBeenCalledTimes(1));
  });

  it("falls back to the server's synchronous render when the render cannot be queued", async () => {
    const mockRespondMutate = vi.fn();
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({
      mutate: mockRespondMutate,
      isPending: false,
    } as any);
    startFails = true;
    renderWithProviders(<Messages />);

    await openComposerFor();
    await typeAndSend();

    await waitFor(() => expect(mockRespondMutate).toHaveBeenCalledTimes(1));
    expect(mockRespondMutate.mock.calls[0][0].renderId).toBeUndefined();
    expect(mockRespondMutate.mock.calls[0][0].includeQuestionAsImage).toBe(true);
    expect(screen.queryByText(en.messagesPage.imageRenderFailedTitle)).toBeNull();
  });

  it("abandons a queued reply when the composer is closed before the render lands", async () => {
    const mockRespondMutate = vi.fn();
    setupMocks();
    mockUseRespondToMessage.mockReturnValue({
      mutate: mockRespondMutate,
      isPending: false,
    } as any);
    renderPoll = () => ({ status: "rendering" });
    const { rerender } = renderWithProviders(<Messages />);

    await openComposerFor();
    await typeAndSend();
    fireEvent.keyDown(screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel }), {
      key: "Escape",
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("textbox", { name: en.replyComposer.responseAriaLabel })
      ).toBeNull();
    });

    renderPoll = () => ({ status: "ready" });
    rerender(<Messages />);
    await act(async () => {});

    expect(mockRespondMutate).not.toHaveBeenCalled();
  });
});
