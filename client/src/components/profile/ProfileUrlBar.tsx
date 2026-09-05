import { ActionIcon, Box, CopyButton, Group, Text, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconClipboard, IconShare, IconWorld } from "@tabler/icons-react";
import { useHaptic } from "use-haptic";

import type { AtmosphereApp } from "../../lib/atmosphereApps";
import { useTranslations } from "../../lib/i18n";

import { AtmosphereLinks } from "./AtmosphereLinks";

import * as styles from "./ProfileUrlBar.styles";

interface ProfileUrlBarProps {
  handle: string;
  url: string;
  shareTitle: string;
  /** The other Atmosphere apps this account is on; empty for most accounts. */
  atmosphereApps: AtmosphereApp[];
}

/** The "fragen.navy/<handle>" pill, with copy and native-share affordances. */
export function ProfileUrlBar({ handle, url, shareTitle, atmosphereApps }: ProfileUrlBarProps) {
  const { triggerHaptic } = useHaptic(1);
  const messages = useTranslations();

  const share = async () => {
    triggerHaptic();
    try {
      await navigator.share({ title: shareTitle, url });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      notifications.show({
        color: "red",
        title: messages.profileUrlBar.shareFailedTitle,
        message: messages.profileUrlBar.shareFailedMessage,
      });
    }
  };

  return (
    <Group justify="space-between" align="center" mb="sm">
      <Group gap="xs" align="center">
        <Box component="span" style={styles.pill}>
          <IconWorld size={12} />
          fragen.navy/
          <Text component="span" inherit style={styles.pillHandle}>
            {handle}
          </Text>
        </Box>

        <CopyButton value={url}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? messages.common.copied : messages.common.copyLink} withArrow>
              <ActionIcon
                onClick={() => {
                  triggerHaptic();
                  copy();
                }}
                variant="subtle"
                radius="xl"
                size="md"
                aria-label={messages.profileUrlBar.copyProfileLinkAriaLabel}
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
            aria-label={messages.profileUrlBar.shareProfileLinkAriaLabel}
            style={styles.action}
          >
            <IconShare size={14} />
          </ActionIcon>
        )}
      </Group>

      <AtmosphereLinks apps={atmosphereApps} />
    </Group>
  );
}
