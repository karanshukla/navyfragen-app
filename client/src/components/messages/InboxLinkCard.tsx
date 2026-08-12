import { Box, Button, CopyButton, Group, Paper, Text, Tooltip } from "@mantine/core";
import { IconClipboard } from "@tabler/icons-react";
import { useHaptic } from "use-haptic";

import { warmOgCard } from "../../lib/ogWarm";
import ShareButton, { onGradientButton } from "../ShareButton";

import * as styles from "./InboxLinkCard.styles";

interface InboxLinkCardProps {
  /** Display form, e.g. "fragen.navy/karan.bsky.social". */
  shortUrl: string;
  fullUrl: string;
  /** Whose OG card to warm — copying or sharing means a crawler is coming. */
  handle: string;
  shareData: { title: string; text: string; url: string };
}

export function InboxLinkCard({ shortUrl, fullUrl, handle, shareData }: InboxLinkCardProps) {
  const { triggerHaptic } = useHaptic(1);
  const warmShareTarget = () => warmOgCard(handle);

  return (
    <Paper mb="md" p="lg" style={styles.card}>
      <Group align="center" gap="md" wrap="wrap">
        <Box style={{ flex: 1, minWidth: 200 }}>
          <Text size="xs" fw={500} mb={6} style={styles.eyebrow}>
            Your inbox link · publicly accessible
          </Text>
          <Text fw={700} fz={17} style={styles.url}>
            {shortUrl}
          </Text>
        </Box>
        <Group gap="xs" wrap="wrap">
          <CopyButton value={fullUrl}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? "Copied!" : "Copy link"} withArrow>
                <Button
                  onClick={() => {
                    triggerHaptic();
                    copy();
                    warmShareTarget();
                  }}
                  size="sm"
                  radius="xl"
                  variant="transparent"
                  leftSection={<IconClipboard size={14} />}
                  style={onGradientButton}
                >
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </Tooltip>
            )}
          </CopyButton>
          <ShareButton shareData={shareData} onSuccess={warmShareTarget} />
        </Group>
      </Group>
    </Paper>
  );
}
