import { Box, Button, Group, Text, Textarea, Tooltip } from "@mantine/core";
import { IconSend2 } from "@tabler/icons-react";
import { useHaptic } from "use-haptic";

import { BRAND_GRADIENT } from "../../styles/tokens";

import { CharRing } from "./CharRing";
import * as styles from "./ReplyComposer.styles";

interface ReplyComposerProps {
  value: string;
  onChange: (value: string) => void;
  characterLimit: number;
  onSend: () => void;
  onCancel: () => void;
  sending: boolean;
  /** True while an unanswered thread root is holding this reply back. */
  blocked: boolean;
  /** Whether sending will chain onto an existing thread rather than post fresh. */
  inThread: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function ReplyComposer({
  value,
  onChange,
  characterLimit,
  onSend,
  onCancel,
  sending,
  blocked,
  inThread,
  textareaRef,
}: ReplyComposerProps) {
  const { triggerHaptic } = useHaptic(1);

  return (
    <Box onClick={(e) => e.stopPropagation()} style={styles.panel}>
      <Textarea
        ref={textareaRef}
        value={value}
        maxLength={characterLimit}
        onChange={(e) => onChange(e.target.value)}
        autosize
        minRows={2}
        maxRows={4}
        aria-label="Your response"
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder="write your reply…"
        styles={styles.textarea}
      />
      <Group justify="space-between" align="center" mt={8}>
        <Group gap={8} align="center">
          <CharRing count={value.length} limit={characterLimit} />
          <Text size="xs" style={styles.count}>
            {value.length}/{characterLimit}
          </Text>
        </Group>
        <Tooltip
          label="Respond to the thread root first"
          disabled={!blocked}
          withArrow
          openDelay={300}
        >
          <Button
            size="xs"
            onClick={() => {
              triggerHaptic();
              onSend();
            }}
            loading={sending}
            disabled={blocked}
            variant="gradient"
            gradient={BRAND_GRADIENT}
            leftSection={<IconSend2 size={12} />}
          >
            {inThread ? "Reply to thread" : "Reply"}
          </Button>
        </Tooltip>
      </Group>
    </Box>
  );
}
