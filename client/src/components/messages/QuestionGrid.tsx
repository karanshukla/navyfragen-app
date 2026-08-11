import { SimpleGrid } from "@mantine/core";
import { useEffect, useRef, useState } from "react";

import type { Message } from "../../api/messageService";
import { useCardKeyboardNav } from "../../lib/useCardKeyboardNav";
import type { ThreadRoot } from "../../lib/useThreadRoot";

import { QuestionCard } from "./QuestionCard";
import { ReplyComposer } from "./ReplyComposer";

/** Long enough for the composer's expansion to settle before we scroll to it. */
const EXPAND_SCROLL_DELAY_MS = 150;

interface QuestionGridProps {
  messages: Message[];
  thread: ThreadRoot;
  gradient: boolean;
  /** Which card has its composer open. Owned by the page, which also closes it. */
  respondingTid: string | null;
  onExpand: (tid: string) => void;
  onCollapse: () => void;
  responseText: string;
  onResponseTextChange: (text: string) => void;
  /** Character budget for a reply to this message, net of link and quote text. */
  characterLimitFor: (message: Message) => number;
  onSend: (message: Message, response: string) => void;
  sending: boolean;
  /** True while the open composer's send is held back by its question image. */
  awaitingRender: boolean;
  /** Whether replies will carry a rendered question image, which is the slow path. */
  includesImage: boolean;
  deletingTid: string | null;
  onDelete: (tid: string) => void;
  onTogglePin: (tid: string) => void;
}

/**
 * The question grid, and the roving focus that walks it. Card contents are
 * QuestionCard's problem; this owns only which card is focused and the effects
 * that follow from expanding one.
 */
export function QuestionGrid({
  messages,
  thread,
  gradient,
  respondingTid,
  onExpand,
  onCollapse,
  responseText,
  onResponseTextChange,
  characterLimitFor,
  onSend,
  sending,
  awaitingRender,
  includesImage,
  deletingTid,
  onDelete,
  onTogglePin,
}: QuestionGridProps) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const expandedIndex = messages.findIndex((m) => m.tid === respondingTid);

  useCardKeyboardNav({
    count: messages.length,
    focusedIndex,
    setFocusedIndex,
    expandedIndex,
    onCollapse,
    cardRefs,
  });

  useEffect(() => {
    cardRefs.current = messages.map(() => null);
  }, [messages]);

  // Deferred so the scroll lands after the composer's expansion reflows the
  // grid; the cleanup stops a stale timer scrolling a card from a prior
  // interaction.
  useEffect(() => {
    if (!respondingTid) return;
    textareaRef.current?.focus();
    const card = document.getElementById(`message-card-${respondingTid}`);
    const handle = setTimeout(
      /* istanbul ignore next */
      () => card?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      EXPAND_SCROLL_DELAY_MS
    );
    return () => clearTimeout(handle);
  }, [respondingTid]);

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
      {messages.map((message, index) => {
        const pinned = thread.isRoot(message.tid);
        const expanded = respondingTid === message.tid;
        const blocked = thread.isReplyBlocked(message.tid);
        const inThread = !pinned && thread.rootTid !== null;

        const toggleExpanded = () => {
          if (expanded) {
            onCollapse();
            return;
          }
          setFocusedIndex(index);
          onExpand(message.tid);
        };

        return (
          <QuestionCard
            key={message.tid}
            message={message}
            gradient={gradient}
            pinned={pinned}
            focused={focusedIndex === index}
            expanded={expanded}
            justPinned={thread.justPinnedTid === message.tid}
            deleting={deletingTid === message.tid}
            blocked={blocked}
            inThread={inThread}
            threadLink={pinned ? thread.linkFor(message.tid) : undefined}
            onFocus={() => setFocusedIndex(index)}
            onToggleExpanded={toggleExpanded}
            onTogglePin={() => onTogglePin(message.tid)}
            onDelete={() => onDelete(message.tid)}
            cardRef={(el) => {
              cardRefs.current[index] = el;
            }}
            composer={
              <ReplyComposer
                value={responseText}
                onChange={onResponseTextChange}
                characterLimit={characterLimitFor(message)}
                onSend={() => onSend(message, responseText)}
                onCancel={() => {
                  onCollapse();
                  cardRefs.current[index]?.focus();
                }}
                sending={sending}
                blocked={blocked}
                inThread={inThread}
                includesImage={includesImage}
                awaitingRender={awaitingRender}
                textareaRef={textareaRef}
              />
            }
          />
        );
      })}
    </SimpleGrid>
  );
}
