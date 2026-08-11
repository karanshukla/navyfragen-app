import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as messageServiceModule from "../../api/messageService";
import { RENDER_LOST_MESSAGE, useQuestionRender } from "../../lib/useQuestionRender";

vi.mock("../../api/messageService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/messageService")>();
  return {
    ...actual,
    messageService: { ...actual.messageService, warmImageService: vi.fn() },
    useStartRender: vi.fn(),
    useRenderStatus: vi.fn(),
  };
});

const mockUseStartRender = vi.mocked(messageServiceModule.useStartRender);
const mockUseRenderStatus = vi.mocked(messageServiceModule.useRenderStatus);
const mockWarm = vi.mocked(messageServiceModule.messageService.warmImageService);

type StartCallbacks = {
  onSuccess?: (data: { renderId: string; status: string }) => void;
  onError?: (error: unknown) => void;
};
type Poll = { status: string; error?: string } | undefined;

/**
 * What the fake server reports, per attempt. Attempt-keyed because that is the
 * real difference between a key that was lost once and one that keeps vanishing.
 */
let polled: (attempt: number) => Poll;
const always = (poll: Poll) => () => poll;
/** Set when a test wants to resolve the start mutation itself. */
let deferStart = false;
/** Set when the render endpoint itself is the thing that is broken. */
let startFails = false;
let pendingStart: StartCallbacks | undefined;
let nextRenderId = "render-1";

const startRender = vi.fn((_data: unknown, callbacks?: StartCallbacks) => {
  if (deferStart) {
    pendingStart = callbacks;
    return;
  }
  if (startFails) {
    callbacks?.onError?.({ error: "not found", status: 404 });
    return;
  }
  callbacks?.onSuccess?.({ renderId: nextRenderId, status: "pending" });
});
const startRenderResult = { mutate: startRender };

const TARGET = { tid: "msg-1", original: "Hello?" };

function renderQuestionRender(props: Partial<Parameters<typeof useQuestionRender>[0]> = {}) {
  return renderHook((args: Parameters<typeof useQuestionRender>[0]) => useQuestionRender(args), {
    initialProps: { target: TARGET, theme: "default", enabled: true, ...props },
  });
}

describe("useQuestionRender", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    polled = always(undefined);
    deferStart = false;
    startFails = false;
    pendingStart = undefined;
    nextRenderId = "render-1";
    mockUseStartRender.mockReturnValue(startRenderResult as any);
    // Mirrors the real query, which is disabled until there is a key to poll.
    mockUseRenderStatus.mockImplementation(
      (renderId, attempt) => ({ data: renderId ? polled(attempt) : undefined }) as any
    );
  });

  it("starts a render when the composer opens with the image toggle already on", () => {
    renderQuestionRender();
    expect(startRender).toHaveBeenCalledTimes(1);
    expect(startRender.mock.calls[0][0]).toEqual({
      tid: "msg-1",
      original: "Hello?",
      theme: "default",
    });
  });

  it("starts a render when the image toggle is flipped on with the composer already open", () => {
    const { rerender } = renderQuestionRender({ enabled: false });
    expect(startRender).not.toHaveBeenCalled();

    rerender({ target: TARGET, theme: "default", enabled: true });
    expect(startRender).toHaveBeenCalledTimes(1);
  });

  it("warms the image service alongside the render, for the sync fallback", () => {
    renderQuestionRender();
    expect(mockWarm).toHaveBeenCalledTimes(1);
  });

  it("stays idle, and warms nothing, while no composer is open", () => {
    const { result } = renderQuestionRender({ target: null });
    expect(result.current.status).toBe("idle");
    expect(startRender).not.toHaveBeenCalled();
    expect(mockWarm).not.toHaveBeenCalled();
  });

  it("reports pending until the first poll comes back", () => {
    const { result } = renderQuestionRender();
    expect(result.current.status).toBe("pending");
    expect(result.current.readyRenderId).toBeNull();
  });

  it("hands over the render key once the poll reports ready", () => {
    polled = always({ status: "ready" });
    const { result } = renderQuestionRender();
    expect(result.current.status).toBe("ready");
    expect(result.current.readyRenderId).toBe("render-1");
  });

  it("surfaces the specific error a failed render carries", () => {
    polled = always({ status: "failed", error: "image service unreachable" });
    const { result } = renderQuestionRender();
    expect(result.current.status).toBe("failed");
    expect(result.current.error).toBe("image service unreachable");
    expect(result.current.readyRenderId).toBeNull();
  });

  it("re-renders on an unknown key instead of surfacing an error", () => {
    polled = (attempt) => (attempt === 0 ? { status: "unknown" } : { status: "rendering" });
    const { result } = renderQuestionRender();
    // One start for the open composer, one for the key the server lost.
    expect(startRender).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("rendering");
    expect(result.current.error).toBeUndefined();
  });

  it("reports the loss rather than re-rendering again when the same key comes back unknown", () => {
    polled = always({ status: "unknown" });
    const { result } = renderQuestionRender();
    expect(startRender).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("failed");
    expect(result.current.error).toBe(RENDER_LOST_MESSAGE);
  });

  it("polls a different render for each attempt, so a retry never reads the last result", () => {
    polled = always({ status: "unknown" });
    renderQuestionRender();
    const attempts = mockUseRenderStatus.mock.calls.map((call) => call[1]);
    expect(Math.max(...attempts)).toBeGreaterThan(0);
  });

  it("recover() after a 409 goes back to waiting instead of re-offering the key", () => {
    polled = (attempt) => (attempt === 0 ? { status: "ready" } : { status: "rendering" });
    const { result } = renderQuestionRender();
    expect(result.current.readyRenderId).toBe("render-1");

    act(() => {
      result.current.recover();
    });

    expect(result.current.readyRenderId).toBeNull();
    expect(startRender).toHaveBeenCalledTimes(2);
  });

  it("retry() starts a fresh render and clears a reported loss", () => {
    polled = always({ status: "unknown" });
    const { result } = renderQuestionRender();
    expect(result.current.status).toBe("failed");

    act(() => {
      polled = always({ status: "rendering" });
      result.current.retry();
    });

    expect(result.current.status).toBe("rendering");
    expect(result.current.error).toBeUndefined();
    expect(startRender).toHaveBeenCalledTimes(3);
  });

  it("recover() before the render has a key leaves the render already in flight alone", () => {
    deferStart = true;
    const { result } = renderQuestionRender();

    act(() => {
      result.current.recover();
    });

    expect(startRender).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("pending");
  });

  it("reports the render unavailable when it cannot even be queued", () => {
    startFails = true;
    const { result } = renderQuestionRender();
    expect(result.current.status).toBe("unavailable");
    expect(result.current.readyRenderId).toBeNull();
  });

  it("retry() clears an unavailable render so a working endpoint is used again", () => {
    startFails = true;
    const { result } = renderQuestionRender();
    expect(result.current.status).toBe("unavailable");

    act(() => {
      startFails = false;
      polled = always({ status: "rendering" });
      result.current.retry();
    });

    expect(result.current.status).toBe("rendering");
  });

  it("a different theme is a different render", () => {
    const { rerender } = renderQuestionRender();
    expect(startRender).toHaveBeenCalledTimes(1);

    rerender({ target: TARGET, theme: "sunset", enabled: true });
    expect(startRender).toHaveBeenCalledTimes(2);
    expect(startRender.mock.calls[1][0]).toMatchObject({ theme: "sunset" });
  });

  it("ignores the failure of a render the composer has already moved on from", () => {
    deferStart = true;
    const { result, rerender } = renderQuestionRender();
    const superseded = pendingStart;

    deferStart = false;
    polled = always({ status: "ready" });
    rerender({ target: { tid: "msg-2", original: "Another?" }, theme: "default", enabled: true });
    expect(result.current.status).toBe("ready");

    act(() => {
      superseded?.onError?.({ error: "not found", status: 404 });
    });

    expect(result.current.status).toBe("ready");
  });

  it("ignores the key of a render the composer has already moved on from", () => {
    deferStart = true;
    const { result, rerender } = renderQuestionRender();
    const superseded = pendingStart;

    rerender({ target: null, theme: "default", enabled: true });
    act(() => {
      superseded?.onSuccess?.({ renderId: "stale-render", status: "ready" });
    });

    polled = always({ status: "ready" });
    rerender({ target: null, theme: "default", enabled: true });
    expect(result.current.readyRenderId).toBeNull();
  });
});
