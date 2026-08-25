import { Box, Group, NavLink, Skeleton, Stack, Text } from "@mantine/core";
import {
  IconAdjustments,
  IconHome,
  IconLogin,
  IconMessage,
  IconSettings,
  IconUser,
} from "@tabler/icons-react";
import { useLocation, Link } from "react-router";
import { useHaptic } from "use-haptic";

import { useSession } from "./api/authService";
import { useFriends } from "./api/profileService";
import { useUserStats } from "./api/settingsService";
import { FriendSection } from "./components/nav/FriendSection";
import { MessageCountBadge } from "./components/nav/MessageCountBadge";
import { APP_NAME } from "./lib/brand";
import { useTranslations } from "./lib/i18n";
import * as styles from "./Navigation.styles";
import { useNavShortcuts } from "./lib/useNavShortcuts";

interface NavigationProps {
  onLinkClick?: () => void;
}

export function Navigation({ onLinkClick }: NavigationProps) {
  const location = useLocation();
  const messages = useTranslations();
  /** The three ways a Navyfragen user can be related to you. */
  const friendGroups = [
    {
      key: "moots",
      label: messages.nav.friendGroups.moots,
      emptyText: `No mutuals on ${APP_NAME} yet.`,
    },
    {
      key: "following",
      label: messages.nav.friendGroups.following,
      emptyText: `No one-sided follows on ${APP_NAME} yet.`,
    },
    {
      key: "oomfs",
      label: messages.nav.friendGroups.oomfs,
      emptyText: `None of your followers are on ${APP_NAME} yet.`,
    },
  ] as const;
  const { data: sessionData, isLoading: isSessionLoading } = useSession();
  const isLoggedIn = !!sessionData?.isLoggedIn;
  const did = sessionData?.did ?? undefined;
  const { data: friendsData, isLoading: friendsLoading } = useFriends(
    isLoggedIn ? (did ?? null) : null
  );
  const { data: userStats } = useUserStats();

  const { triggerHaptic } = useHaptic(1);
  const handleClick = () => {
    triggerHaptic();
    onLinkClick?.();
  };

  useNavShortcuts({ isLoggedIn, isSessionLoading, onNavigate: onLinkClick });

  const isActive = (path: string) => location.pathname === path;
  const linkProps = (path: string, label: string, icon: React.ReactNode) => ({
    my: 2,
    label,
    component: Link,
    to: path,
    active: isActive(path),
    onClick: handleClick,
    leftSection: icon,
    styles: styles.navItem(isActive(path)),
  });

  const viewingHandle = location.pathname.match(/^\/profile\/(.+)$/)?.[1];
  const unread = userStats?.messageCount ?? 0;

  return (
    <Box style={styles.root}>
      <Box style={{ flexShrink: 0 }}>
        <NavLink
          {...linkProps("/", messages.common.shortcuts.home, <IconHome size={16} stroke={1.5} />)}
        />

        {isLoggedIn ? (
          <>
            <NavLink
              {...linkProps(
                "/messages",
                messages.common.shortcuts.messages,
                <IconMessage size={16} stroke={1.5} />
              )}
              rightSection={
                !isActive("/messages") && unread > 0 ? (
                  <MessageCountBadge count={unread} />
                ) : undefined
              }
            />
            <NavLink
              {...linkProps(
                "/customise",
                messages.common.shortcuts.customise,
                <IconAdjustments size={16} stroke={1.5} />
              )}
            />
            <NavLink
              {...linkProps(
                "/settings",
                messages.common.shortcuts.settings,
                <IconSettings size={16} stroke={1.5} />
              )}
            />
          </>
        ) : isSessionLoading ? (
          <Group gap={10} wrap="nowrap" my={2} px={12} py={8} data-testid="nav-login-skeleton">
            <Skeleton circle height={16} width={16} style={{ flexShrink: 0 }} />
            <Skeleton height={12} width="40%" radius="sm" />
          </Group>
        ) : (
          <NavLink
            {...linkProps(
              "/login",
              messages.common.shortcuts.login,
              <IconLogin size={16} stroke={1.5} />
            )}
          />
        )}

        {viewingHandle && <ViewingProfile handle={viewingHandle} />}
      </Box>

      {isLoggedIn && did && (
        <Box style={styles.friendsScroller}>
          {friendsLoading ? (
            <FriendsSkeleton />
          ) : (
            friendGroups.map(({ key, label, emptyText }) => (
              <FriendSection
                key={key}
                label={label}
                friends={friendsData?.[key] ?? []}
                emptyText={emptyText}
                onLinkClick={handleClick}
                did={did}
              />
            ))
          )}
        </Box>
      )}

      {!isLoggedIn && <Box style={{ flex: 1 }} />}
    </Box>
  );
}

/** Context chip shown while looking at someone else's public profile. */
function ViewingProfile({ handle }: { handle: string }) {
  const messages = useTranslations();
  return (
    <Box mt={4} px={12} py={8} style={styles.viewingProfile}>
      <IconUser size={13} stroke={1.5} style={{ opacity: 0.5, flexShrink: 0 }} />
      <Box style={{ minWidth: 0 }}>
        <Text fz={9} c="dimmed">
          {messages.nav.viewingProfile}
        </Text>
        <Text fz={12} fw={600} truncate>
          @{handle}
        </Text>
      </Box>
    </Box>
  );
}

function FriendsSkeleton() {
  return (
    <>
      <Box mt="lg" mb="xs" px={2}>
        <Skeleton height={10} width="60%" radius="sm" />
      </Box>
      <Stack gap={6}>
        {[0, 1, 2].map((i) => (
          <Group key={i} gap="xs" px={4} py={4}>
            <Skeleton circle height={28} width={28} style={{ flexShrink: 0 }} />
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Skeleton height={10} mb={4} radius="sm" />
              <Skeleton height={8} width="60%" radius="sm" />
            </Box>
          </Group>
        ))}
      </Stack>
    </>
  );
}
