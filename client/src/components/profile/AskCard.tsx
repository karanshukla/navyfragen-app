import { ActionIcon, Alert, Button, Group, Paper, Stack, Text, Textarea } from "@mantine/core";
import { IconSend, IconX } from "@tabler/icons-react";
import { useHaptic } from "use-haptic";

import { useTranslations } from "../../lib/i18n";
import type { TouchpointTranslations } from "../../lib/touchpointTranslations";
import { useNumberFormat } from "../../lib/useNumberFormat";
import { highlightButton } from "../../styles/tokens";

import * as styles from "./AskCard.styles";

interface AskCardProps {
  gradient: string;
  headline: string;
  maxLength: number;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  /** False when the owner has closed their inbox; the composer is replaced. */
  open: boolean;
  error: string | null;
  onDismissError: () => void;
  translations: TouchpointTranslations;
  cardRef: React.RefObject<HTMLDivElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

/** The anonymous-question composer: a brand-gradient card with a paper input. */
export function AskCard({
  gradient,
  headline,
  maxLength,
  value,
  onChange,
  onSend,
  sending,
  open,
  error,
  onDismissError,
  translations,
  cardRef,
  textareaRef,
}: AskCardProps) {
  const { triggerHaptic } = useHaptic(1);
  const messages = useTranslations();
  const formatNumber = useNumberFormat();

  return (
    <Paper ref={cardRef} onClick={() => textareaRef.current?.focus()} style={styles.card(gradient)}>
      <Text fw={700} mb="lg" ta="center" fz={22} style={styles.headline}>
        {headline}
      </Text>

      <Stack gap="xs">
        {error && (
          <Alert
            color="red"
            withCloseButton
            onClose={onDismissError}
            role="alert"
            styles={styles.errorAlert}
          >
            {error}
          </Alert>
        )}
        {open ? (
          <>
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
              minRows={2}
              maxRows={4}
              autosize
              disabled={sending}
              aria-label={headline}
              placeholder={translations.placeholder}
              description={`${formatNumber(value.length)}/${formatNumber(maxLength)}`}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if (e.shiftKey || e.altKey || e.metaKey) return;
                e.preventDefault();
                onSend();
              }}
              radius="md"
              styles={styles.textarea}
            />
            <Group justify="flex-end" gap="xs">
              <ActionIcon
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic();
                  onChange("");
                }}
                variant="subtle"
                color="white"
                size="lg"
                radius="md"
                aria-label={messages.askCard.clearMessage}
              >
                <IconX size={18} />
              </ActionIcon>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic();
                  onSend();
                }}
                loading={sending}
                radius="md"
                leftSection={<IconSend size={16} />}
                color="highlight"
                variant="filled"
                style={highlightButton}
              >
                {translations.sendLabel}
              </Button>
            </Group>
          </>
        ) : (
          <Text ta="center" fz={15} style={styles.closedNotice}>
            {translations.inboxClosed}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
