import { useCallback, useEffect, useState } from "react";

import {
  messageService,
  useRenderStatus,
  useStartRender,
  type RenderStatus,
} from "../api/messageService";

/**
 * `idle` while nothing needs rendering, `unavailable` when the render could not
 * even be queued — which is the caller's cue to take the server's permanent
 * synchronous fallback. Everything else is the server's view of the render.
 */
export type QuestionRenderStatus = RenderStatus | "idle" | "unavailable";

/** What a second loss of the same render key leaves the composer to say. */
export const RENDER_LOST_MESSAGE = "The question image could not be rendered. Try sending again.";

/** What a poll the server will not answer leaves the composer to say. */
export const RENDER_UNREACHABLE_MESSAGE =
  "Could not check on the question image. Try sending again.";

export interface QuestionRenderArgs {
  /** The question whose composer is open, or null when none is. */
  target: { tid: string; original: string } | null;
  /** The owner's stored image theme — a different theme is a different render. */
  theme?: string;
  /** False when replies are text only, which needs no render at all. */
  enabled: boolean;
}

export interface QuestionRender {
  status: QuestionRenderStatus;
  /** The key to post with. Non-null only while the store holds a ready render. */
  readyRenderId: string | null;
  /** The specific failure behind a `failed` status. */
  error?: string;
  /** Starts over after a failure the user has already been told about. */
  retry: () => void;
  /** Feeds a respond 409 back in, so the send goes back to waiting on a poll. */
  recover: () => void;
}

/**
 * Keeps a question-image render in flight for whichever composer is open, so the
 * cold start of the image service overlaps with the user typing instead of
 * following their send.
 *
 * The render is started from the same intent signal the image service is warmed
 * from — an open composer that will carry an image — which covers both opening
 * the composer with the toggle already on and flipping it on afterwards.
 *
 * @see [useQuestionRender.test.tsx](../tests/lib/useQuestionRender.test.tsx):
 * pins that both of those entry paths start a render, that an `unknown` poll
 * re-renders rather than erroring, that a second `unknown` for the same key
 * stops instead of looping, that a render which cannot be queued at all reports
 * `unavailable` rather than stranding the send, and that a poll the server will
 * not answer fails rather than waiting on `pending` forever.
 */
export function useQuestionRender({ target, theme, enabled }: QuestionRenderArgs): QuestionRender {
  const tid = target?.tid ?? null;
  const original = target?.original ?? null;

  const [renderId, setRenderId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [restartedFor, setRestartedFor] = useState<string | null>(null);
  const [lost, setLost] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const { mutate: startRender } = useStartRender();
  const poll = useRenderStatus(renderId, attempt);

  useEffect(() => {
    setRestartedFor(null);
    setLost(false);
    setUnavailable(false);
  }, [enabled, tid, original, theme]);

  useEffect(() => {
    setRenderId(null);
    if (!enabled || tid === null || original === null) return;
    // The sync fallback in /messages/respond is permanent, so the warm still
    // earns its place alongside the queued render.
    void messageService.warmImageService();
    let live = true;
    startRender(
      { tid, original, theme },
      {
        onSuccess: (data) => {
          if (live) setRenderId(data.renderId);
        },
        onError: () => {
          if (live) setUnavailable(true);
        },
      }
    );
    return () => {
      live = false;
    };
  }, [enabled, tid, original, theme, attempt, startRender]);

  /** One automatic re-render per lost key; a second loss is reported instead. */
  const recover = useCallback(() => {
    // Nothing to re-render: a render is already on its way to producing a key.
    if (renderId === null) return;
    if (restartedFor === renderId) {
      setLost(true);
      return;
    }
    setRestartedFor(renderId);
    setAttempt((n) => n + 1);
  }, [renderId, restartedFor]);

  const retry = useCallback(() => {
    setRestartedFor(null);
    setLost(false);
    setUnavailable(false);
    setAttempt((n) => n + 1);
  }, []);

  const polled = poll.data?.status;

  useEffect(() => {
    if (polled !== "unknown") return;
    recover();
  }, [polled, recover]);

  // A poll that cannot be read is a render that will never be handed over: the
  // status query is what carries every terminal answer, so leaving it out of the
  // ladder below leaves the caller waiting on `pending` forever.
  const unreachable = poll.isError;

  const idle = !enabled || tid === null || original === null;
  let status: QuestionRenderStatus = "pending";
  if (idle) status = "idle";
  else if (unavailable) status = "unavailable";
  else if (lost) status = "failed";
  else if (unreachable) status = "failed";
  else if (polled !== undefined) status = polled;

  let error = poll.data?.error;
  if (lost) error = RENDER_LOST_MESSAGE;
  else if (unreachable) error = poll.error?.error || RENDER_UNREACHABLE_MESSAGE;

  return {
    status,
    readyRenderId: status === "ready" ? renderId : null,
    error,
    retry,
    recover,
  };
}
