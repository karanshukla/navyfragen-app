import { Avatar, Box, Collapse, Group, NavLink, Text, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconChevronDown } from "@tabler/icons-react";
import { Link } from "react-router";
import { useHaptic } from "use-haptic";

import type { Friend } from "../../api/profileService";
import { isSectionOpen, setSectionOpen } from "../../lib/navSectionStorage";
import { WinkMark } from "../WinkMark";

import * as styles from "./FriendSection.styles";

interface FriendSectionProps {
  label: string;
  friends: Friend[];
  emptyText: string;
  onLinkClick: () => void;
  /** The signed-in account; the collapsed/expanded choice is stored per DID. */
  did: string;
}

/** One collapsible group of Navyfragen users in the sidebar. */
export function FriendSection({ label, friends, emptyText, onLinkClick, did }: FriendSectionProps) {
  const [opened, { toggle }] = useDisclosure(isSectionOpen(label, did));
  const { triggerHaptic } = useHaptic(1);

  return (
    <>
      <UnstyledButton
        onClick={() => {
          triggerHaptic();
          setSectionOpen(label, !opened, did);
          toggle();
        }}
        mb="xs"
        px={2}
        aria-expanded={opened}
        aria-label={`${label} — ${opened ? "collapse" : "expand"}`}
        style={styles.header}
      >
        <Text size="xs" fw={600} c="dimmed" style={{ flex: 1 }}>
          {label}
        </Text>
        <IconChevronDown size={12} style={styles.chevron(opened)} />
      </UnstyledButton>

      <Collapse expanded={opened}>
        {friends.length > 0 ? (
          <Box style={{ overflowX: "hidden" }}>
            {friends.map((friend) => (
              <NavLink
                key={friend.did}
                label={<FriendIdentity friend={friend} />}
                component={Link}
                to={`/profile/${friend.handle}`}
                onClick={onLinkClick}
                py={4}
                styles={styles.friendLink}
              />
            ))}
          </Box>
        ) : (
          <Text size="xs" c="dimmed" px={2} style={{ lineHeight: 1.6 }}>
            {emptyText}
          </Text>
        )}
      </Collapse>
    </>
  );
}

function FriendIdentity({ friend }: { friend: Friend }) {
  return (
    <Group gap={10} wrap="nowrap" style={{ overflow: "hidden", width: "100%" }}>
      <Avatar
        size={28}
        radius="xl"
        src={friend.avatar || undefined}
        alt={friend.displayName || friend.handle}
        style={{ flexShrink: 0 }}
      >
        <WinkMark size={22} sparkle={false} aria-hidden />
      </Avatar>
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text fz={13} fw={600} truncate style={{ lineHeight: 1.3 }}>
          {friend.displayName || friend.handle}
        </Text>
        <Text fz={10} c="dimmed" truncate style={{ lineHeight: 1.3 }}>
          @{friend.handle}
        </Text>
      </Box>
    </Group>
  );
}
