import { Avatar, Box, Button, Group, Paper, Text } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";

import { useTranslations } from "../../lib/i18n";
import { mentionLinkFor } from "../../lib/mentionLink";
import { clientDestinationFor } from "../../lib/waypointClients";
import { profileWaypointTargetFor } from "../../lib/waypointTarget";
import { parseRichText } from "../../utils/parseRichText";
import { WinkMark } from "../WinkMark";

import * as styles from "./ProfileCard.styles";

export interface ProfileSummary {
  did?: string;
  handle?: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
}

interface ProfileCardProps {
  profile: ProfileSummary;
  /**
   * The client the *viewer* picked on /customise, never the one the account
   * being viewed picked — that setting is private and a public profile does
   * not carry it. Null sends the viewer to Bluesky, as before.
   */
  clientId: string | null;
  /** Whether the viewer keeps @mentions in this app instead of following them out. */
  openProfilesInApp: boolean;
}

/** Bluesky-style banner + avatar + bio header for the profile being viewed. */
export function ProfileCard({ profile, clientId, openProfilesInApp }: ProfileCardProps) {
  const messages = useTranslations();
  const destination = clientDestinationFor(
    profileWaypointTargetFor(profile.handle, profile.did),
    clientId
  );
  return (
    <Paper mb="lg" withBorder style={styles.card}>
      <Box style={styles.banner(profile.banner)}>
        {profile.banner && <Box style={styles.bannerScrim} />}
      </Box>

      <Box style={styles.body}>
        <Avatar
          src={profile.avatar}
          alt={profile.displayName || profile.handle || messages.common.userAltFallback}
          size={84}
          radius="xl"
          style={styles.avatar}
        >
          <WinkMark size={60} sparkle={false} aria-hidden />
        </Avatar>

        <Group justify="space-between" align="flex-start" pt={48}>
          <Box>
            <Text fw={800} fz={24} style={styles.displayName}>
              {profile.displayName}
            </Text>
            <Text c="dimmed" mt={2} fz={13}>
              @{profile.handle}
            </Text>
          </Box>
          {destination && (
            <Button
              component="a"
              href={destination.url}
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              size="xs"
              radius="md"
              style={styles.blueskyLink}
              leftSection={<IconExternalLink size={12} />}
            >
              {messages.profileCard.viewOn(destination.name)}
            </Button>
          )}
        </Group>

        {profile.description && (
          <Text mt="sm" fz={14} style={styles.description}>
            {parseRichText(profile.description, mentionLinkFor(clientId, openProfilesInApp))}
          </Text>
        )}
      </Box>
    </Paper>
  );
}
