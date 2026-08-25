import { ActionIcon, Box, Button, Group, Paper, Stack, Text, Tooltip } from "@mantine/core";
import { IconExternalLink, IconPin, IconPinned, IconTrash } from "@tabler/icons-react";
import { useHaptic } from "use-haptic";

import type { Message } from "../../api/messageService";
import { formatTimestamp } from "../../lib/formatTimestamp";
import { useTranslations } from "../../lib/i18n";
import type { ThreadLink } from "../../lib/useThreadRoot";
import { sunshineButton } from "../../styles/tokens";

import * as styles from "./QuestionCard.styles";

interface QuestionCardProps {
  message: Message;
  gradient: boolean;
  pinned: boolean;
  focused: boolean;
  expanded: boolean;
  justPinned: boolean;
  deleting: boolean;
  /** True while this card's own reply is in flight. */
  locked: boolean;
  /** True while an unanswered thread root is holding this reply back. */
  blocked: boolean;
  /** A reply here would chain onto a pinned root rather than post standalone. */
  inThread: boolean;
  /** The Bluesky post this card's answer started, once it has one. */
  threadLink?: ThreadLink;
  onFocus: () => void;
  onToggleExpanded: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  cardRef: (el: HTMLDivElement | null) => void;
  /** The composer, rendered by the grid so it can own the draft text. */
  composer: React.ReactNode;
}

export function QuestionCard({
  message,
  gradient,
  pinned,
  focused,
  expanded,
  justPinned,
  deleting,
  locked,
  blocked,
  inThread,
  threadLink,
  onFocus,
  onToggleExpanded,
  onTogglePin,
  onDelete,
  cardRef,
  composer,
}: QuestionCardProps) {
  const { triggerHaptic } = useHaptic(1);
  const messages = useTranslations();
  const deleteRefusal = pinned
    ? {
        tooltip: messages.questionCard.cannotDeleteThreadRootTooltip,
        label: messages.questionCard.cannotDeleteThreadRootLabel,
      }
    : locked
      ? {
          tooltip: messages.questionCard.cannotDeleteWhilePostingTooltip,
          label: messages.questionCard.cannotDeleteWhilePostingLabel,
        }
      : null;

  return (
    <Paper
      id={`message-card-${message.tid}`}
      ref={cardRef}
      tabIndex={0}
      role="button"
      aria-expanded={expanded}
      radius="lg"
      onFocus={onFocus}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggleExpanded();
        }
      }}
      className={justPinned ? "nf-pinned-card-enter" : undefined}
      style={styles.card({ gradient, pinned, focused })}
      onClick={() => {
        triggerHaptic();
        onToggleExpanded();
      }}
    >
      <Stack gap="sm" style={{ flex: 1 }}>
        <Group justify="space-between" align="center">
          <Text fz={10} style={styles.timestamp}>
            {formatTimestamp(message.createdAt)}
          </Text>
          <Group gap={2} align="center">
            <Tooltip
              label={
                pinned
                  ? messages.questionCard.unpinThreadTooltip
                  : messages.questionCard.pinAsThreadRootTooltip
              }
              withArrow
              position="left"
              openDelay={500}
            >
              <ActionIcon
                size="lg"
                className={pinned ? "nf-pin-btn--active" : "nf-pin-btn"}
                aria-label={
                  pinned
                    ? messages.questionCard.unpinThreadRootLabel
                    : messages.questionCard.setAsThreadRootLabel
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin();
                }}
                variant="transparent"
                radius="md"
                style={styles.iconButton(pinned)}
              >
                {pinned ? <IconPinned size={18} /> : <IconPin size={18} />}
              </ActionIcon>
            </Tooltip>
            <Tooltip
              label={deleteRefusal?.tooltip ?? messages.questionCard.deleteMessageTooltip}
              withArrow
              position="left"
              openDelay={500}
            >
              <ActionIcon
                size="lg"
                className={deleteRefusal ? undefined : "nf-delete-btn"}
                aria-label={deleteRefusal?.label ?? messages.questionCard.deleteMessageLabel}
                onClick={(e) => {
                  e.stopPropagation();
                  if (deleteRefusal) return;
                  triggerHaptic();
                  onDelete();
                }}
                variant="transparent"
                radius="md"
                loading={deleting}
                style={deleteRefusal ? styles.disabledIconButton : styles.iconButton(false)}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <Box style={styles.bodyWrap}>
          <Text fw={600} style={styles.body}>
            {message.message}
          </Text>
        </Box>

        {threadLink?.link && (
          <Box>
            <a
              href={threadLink.link}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={styles.threadLink}
            >
              <IconExternalLink size={11} style={{ flexShrink: 0 }} />
              <span style={styles.threadLinkText}>{threadLink.link.replace("https://", "")}</span>
            </a>
          </Box>
        )}

        {expanded ? (
          composer
        ) : (
          <Box mt={4} onClick={(e) => e.stopPropagation()}>
            <Tooltip
              label={messages.common.respondToThreadRootFirst}
              disabled={!blocked}
              withArrow
              openDelay={300}
            >
              <Button
                onClick={() => {
                  if (blocked) return;
                  triggerHaptic();
                  onToggleExpanded();
                }}
                fullWidth
                radius="md"
                color="sunshine"
                variant="filled"
                fw={700}
                style={{ ...sunshineButton, ...styles.replyButton(blocked) }}
              >
                {inThread ? messages.questionCard.replyToThread : messages.questionCard.reply}
              </Button>
            </Tooltip>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
