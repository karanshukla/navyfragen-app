import { ActionIcon, Box, CopyButton, Group, Text, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconClipboard, IconShare, IconWorld } from "@tabler/icons-react";
import { useHaptic } from "use-haptic";

import * as styles from "./ProfileUrlBar.styles";

interface ProfileUrlBarProps {
  handle: string;
  url: string;
  shareTitle: string;
}

/** The "fragen.navy/<handle>" pill, with copy and native-share affordances. */
export function ProfileUrlBar({ handle, url, shareTitle }: ProfileUrlBarProps) {
  const { triggerHaptic } = useHaptic(1);

  const share = async () => {
    triggerHaptic();
    try {
      await navigator.share({ title: shareTitle, url });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      notifications.show({
        color: "red",
        title: "Share failed",
        message: "Could not share link.",
      });
    }
  };

  return (
    <Group justify="space-between" align="center" mb="sm">
      <Box component="span" style={styles.pill}>
        <IconWorld size={12} />
        fragen.navy/
        <Text component="span" inherit style={styles.pillHandle}>
          {handle}
        </Text>
      </Box>

      <Group gap="xs">
        <CopyButton value={url}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? "Copied!" : "Copy link"} withArrow>
              <ActionIcon
                onClick={() => {
                  triggerHaptic();
                  copy();
                }}
                variant="subtle"
                radius="xl"
                size="md"
                aria-label="Copy profile link"
                style={styles.action}
              >
                <IconClipboard size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>

        {"share" in navigator && (
          <ActionIcon
            onClick={share}
            variant="subtle"
            radius="xl"
            size="md"
            aria-label="Share profile link"
            style={styles.action}
          >
            <IconShare size={14} />
          </ActionIcon>
        )}
      </Group>
    </Group>
  );
}
