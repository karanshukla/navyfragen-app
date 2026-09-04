import { ActionIcon, Box, Button, Group, Modal, Stack, Text, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  useUniversalLink,
  useWaypoints,
  type ShareOutcome,
  type WaypointEntry,
} from "@aturi.to/waypoints-react";
import { IconCopy, IconShare } from "@tabler/icons-react";

import { useTranslations } from "../../lib/i18n";
import type { OpenInPickerMessages } from "../../lib/i18n/types";
import type { WaypointTarget } from "../../lib/waypointTarget";

import * as styles from "./OpenInModal.styles";

/**
 * Which share outcomes are worth a toast. `shared` needs none — the native
 * sheet already confirmed itself — and `dismissed` is a deliberate silence:
 * telling someone their link was copied after they backed out of a share is
 * exactly the surprise `ShareOutcome` distinguishes the two cases to avoid.
 */
const SHARE_NOTICE: Record<
  ShareOutcome,
  { key: "linkCopied" | "shareFailed"; color: string } | null
> = {
  shared: null,
  dismissed: null,
  copied: { key: "linkCopied", color: "green" },
  failed: { key: "shareFailed", color: "red" },
};

interface OpenInModalProps {
  opened: boolean;
  onClose: () => void;
  /** The posted answer every destination in the list is resolved against. */
  target: WaypointTarget;
  /** The client this user picked on /customise, hoisted to the top of the list. */
  defaultClientId: string | null;
}

/**
 * The "Open in…" picker for a posted answer: every Atmosphere client in Aturi's
 * catalog that can render the post, plus a universal link that lets whoever
 * receives it pick for themselves.
 *
 * Built on the catalog's headless `useWaypoints`/`useUniversalLink` hooks rather
 * than its packaged `WaypointPicker`, whose opt-in stylesheet ships its own
 * palette — colour here has to come from the semantic tokens in `index.css`
 * that `src/tests/theme/contrast.test.ts` checks.
 *
 * @see [OpenInModal.test.tsx](../../tests/components/OpenInModal.test.tsx)
 */
export function OpenInModal({ opened, onClose, target, defaultClientId }: OpenInModalProps) {
  const messages = useTranslations();
  const copy = messages.openInPicker;
  const { waypoints, copy: copyUrl, open } = useWaypoints(target);
  const { share } = useUniversalLink({ target });

  const onCopy = async (waypoint: WaypointEntry) => {
    const copied = await copyUrl(waypoint.url);
    notifications.show(
      copied
        ? { message: copy.linkCopied, color: "green" }
        : { message: copy.copyFailed, color: "red" }
    );
  };

  const onShare = async () => {
    const notice = SHARE_NOTICE[await share()];
    if (!notice) return;
    notifications.show({ message: copy[notice.key], color: notice.color });
  };

  const chosen = waypoints.filter((waypoint) => waypoint.id === defaultClientId);
  const rest = waypoints.filter((waypoint) => waypoint.id !== defaultClientId);
  const sections = [
    { heading: copy.yourDefaultHeading, waypoints: chosen },
    { heading: copy.recommendedHeading, waypoints: rest.filter((w) => w.isRecommended) },
    { heading: copy.allHeading, waypoints: rest.filter((w) => !w.isRecommended) },
  ].filter((section) => section.waypoints.length > 0);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={copy.title}
      centered
      onClick={(e) => e.stopPropagation()}
    >
      <Stack gap="md">
        {sections.map((section) => (
          <WaypointSection
            key={section.heading}
            heading={section.heading}
            waypoints={section.waypoints}
            copy={copy}
            onOpen={open}
            onCopy={onCopy}
          />
        ))}
        <Button
          variant="default"
          radius="md"
          leftSection={<IconShare size={16} />}
          onClick={onShare}
        >
          {copy.shareUniversalLink}
        </Button>
      </Stack>
    </Modal>
  );
}

interface WaypointSectionProps {
  heading: string;
  waypoints: WaypointEntry[];
  copy: OpenInPickerMessages;
  onOpen: (url: string) => void;
  onCopy: (waypoint: WaypointEntry) => void;
}

function WaypointSection({ heading, waypoints, copy, onOpen, onCopy }: WaypointSectionProps) {
  return (
    <Stack gap={6}>
      <Text style={styles.sectionHeading}>{heading}</Text>
      {waypoints.map((waypoint) => (
        <Group key={waypoint.id} gap={6} wrap="nowrap">
          <Box
            component="button"
            type="button"
            style={styles.row}
            aria-label={copy.openInLabel(waypoint.name)}
            onClick={() => onOpen(waypoint.url)}
          >
            <Box style={styles.rowIcon}>{waypoint.icon}</Box>
            <Box style={styles.rowText}>
              <Box style={styles.rowName}>{waypoint.name}</Box>
              <Box style={styles.rowDescription}>{waypoint.description}</Box>
            </Box>
          </Box>
          <Tooltip label={copy.copyLinkTooltip} withArrow position="left" openDelay={500}>
            <ActionIcon
              variant="subtle"
              color="gray"
              radius="md"
              aria-label={copy.copyLinkLabel(waypoint.name)}
              onClick={() => onCopy(waypoint)}
            >
              <IconCopy size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ))}
    </Stack>
  );
}
