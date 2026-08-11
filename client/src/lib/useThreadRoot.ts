import { useLocalStorage } from "@mantine/hooks";
import { useEffect, useMemo, useState } from "react";

import type { Message } from "../api/messageService";

/**
 * The "thread root" a session's answers are being chained under.
 *
 * Per the architecture note in CLAUDE.md, the association between an NF message
 * and the Bluesky post that answered it is deliberately client-side only — that
 * is what `threadLinks` is, and why it lives in localStorage rather than being
 * sent to the server.
 *
 * @see [Messages.test.tsx](../tests/pages/Messages.test.tsx): pins pinning,
 * unpinning, the reply-order rule, and the cleanup when a pinned message is
 * deleted elsewhere.
 */

export interface ThreadLink {
  uri: string;
  cid: string;
  link?: string;
}

const PIN_SETTLE_MS = 420;

export interface ThreadRoot {
  rootTid: string | null;
  /** Set for one animation frame after pinning, so the card can settle in. */
  justPinnedTid: string | null;
  /** Messages with the pinned one hoisted to the front. */
  ordered: Message[];
  isRoot: (tid: string) => boolean;
  /** The Bluesky post a pinned message was answered with, once there is one. */
  linkFor: (tid: string) => ThreadLink | undefined;
  /**
   * A thread has to start somewhere: while a root is pinned but unanswered,
   * every other message is held back so replies cannot orphan themselves.
   */
  isReplyBlocked: (tid: string) => boolean;
  /** The post a reply to `tid` should hang off, or undefined to post standalone. */
  replyTarget: (tid: string) => Pick<ThreadLink, "uri" | "cid"> | undefined;
  togglePin: (tid: string) => void;
  recordReply: (tid: string, link: ThreadLink) => void;
}

export function useThreadRoot(
  did: string | null | undefined,
  messages: Message[] | undefined
): ThreadRoot {
  const scope = did ?? "";
  const [rootTid, setRootTid] = useLocalStorage<string | null>({
    key: `threadRootTid-${scope}`,
    defaultValue: null,
    getInitialValueInEffect: true,
  });
  const [links, setLinks] = useLocalStorage<Record<string, ThreadLink>>({
    key: `threadLinks-${scope}`,
    defaultValue: {},
    getInitialValueInEffect: true,
  });
  const [justPinnedTid, setJustPinnedTid] = useState<string | null>(null);

  useEffect(() => {
    if (!messages || !rootTid) return;
    if (messages.some((m) => m.tid === rootTid)) return;
    setLinks((prev) => {
      const next = { ...prev };
      delete next[rootTid];
      return next;
    });
    setRootTid(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, rootTid]);

  const ordered = useMemo(() => {
    const list = messages ?? [];
    if (!rootTid) return list;
    const idx = list.findIndex((m) => m.tid === rootTid);
    if (idx <= 0) return list;
    return [list[idx], ...list.slice(0, idx), ...list.slice(idx + 1)];
  }, [messages, rootTid]);

  const isRoot = (tid: string) => rootTid === tid;
  const rootLink = rootTid ? links[rootTid] : undefined;

  return {
    rootTid,
    justPinnedTid,
    ordered,
    isRoot,
    linkFor: (tid) => links[tid],
    isReplyBlocked: (tid) => !isRoot(tid) && !!rootTid && !rootLink?.uri,
    replyTarget: (tid) =>
      !isRoot(tid) && rootLink?.uri && rootLink?.cid
        ? { uri: rootLink.uri, cid: rootLink.cid }
        : undefined,
    togglePin: (tid) => {
      if (isRoot(tid)) {
        setRootTid(null);
        return;
      }
      setRootTid(tid);
      setJustPinnedTid(tid);
      setTimeout(() => setJustPinnedTid(null), PIN_SETTLE_MS);
    },
    recordReply: (tid, link) => setLinks((prev) => ({ ...prev, [tid]: link })),
  };
}
