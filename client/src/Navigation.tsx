import {
  NavLink,
  Text,
  Box,
  Skeleton,
  Stack,
  Avatar,
  Group,
  Collapse,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconHome,
  IconMessage,
  IconLogin,
  IconSettings,
  IconUser,
  IconChevronDown,
} from "@tabler/icons-react";
import { useEffect } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useHaptic } from "use-haptic";

import { useFriends, Friend } from "./api/profileService";
import { useUserStats } from "./api/settingsService";
import { WinkMark } from "./components/WinkMark";

interface NavigationProps {
  onLinkClick?: () => void;
  isLoggedIn: boolean;
  handle?: string;
  did?: string;
}

// Active nav item: mode-aware — subtle tint in light mode, brand gradient in dark
const activeNavStyle = {
  background: "var(--nf-nav-active-bg)",
  borderRadius: 12,
  color: "var(--nf-nav-active-color)",
  boxShadow: "var(--nf-nav-active-shadow)",
};

const inactiveNavStyle = {
  borderRadius: 12,
  transition: "background 120ms ease",
};

const friendNavLinkStyles = {
  root: { borderRadius: 10, transition: "background 120ms ease" },
};

export function Navigation({ onLinkClick, isLoggedIn, handle: _handle, did }: NavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: friendsData, isLoading: friendsLoading } = useFriends(
    isLoggedIn ? (did ?? null) : null
  );
  const { data: userStats } = useUserStats();

  const { triggerHaptic } = useHaptic(1);
  const handleClick = () => {
    triggerHaptic();
    onLinkClick?.();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const targetNodeName = (event.target as HTMLElement)?.nodeName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(targetNodeName)) return;

      if (event.altKey) {
        let targetPath: string | null = null;
        switch (event.key.toUpperCase()) {
          case "H":
            targetPath = "/";
            break;
          case "M":
            if (isLoggedIn) targetPath = "/messages";
            break;
          case "S":
            if (isLoggedIn) targetPath = "/settings";
            break;
          case "L":
            if (!isLoggedIn) targetPath = "/login";
            break;
        }
        if (targetPath) {
          event.preventDefault();
          navigate(targetPath);
          onLinkClick?.();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isLoggedIn, navigate, onLinkClick]);

  const isActive = (path: string) => location.pathname === path;

  const navItemStyles = (path: string) => ({
    root: isActive(path) ? activeNavStyle : inactiveNavStyle,
    label: {
      fontFamily: "Inter, sans-serif",
      fontSize: 16,
      fontWeight: isActive(path) ? 600 : 500,
    },
  });

  const profileMatch = location.pathname.match(/^\/profile\/(.+)$/);
  const viewingHandle = profileMatch ? profileMatch[1] : null;

  return (
    <Box style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box style={{ flexShrink: 0 }}>
        <NavLink
          my={2}
          label="Home"
          component={Link}
          to="/"
          active={isActive("/")}
          onClick={handleClick}
          leftSection={<IconHome size={16} stroke={1.5} />}
          styles={navItemStyles("/")}
        />
        {isLoggedIn ? (
          <>
            <NavLink
              my={2}
              label="Messages"
              component={Link}
              to="/messages"
              active={isActive("/messages")}
              onClick={handleClick}
              leftSection={<IconMessage size={16} stroke={1.5} />}
              rightSection={
                !isActive("/messages") && (userStats?.messageCount ?? 0) > 0 ? (
                  <MessageCountBadge count={userStats!.messageCount} />
                ) : undefined
              }
              styles={navItemStyles("/messages")}
            />
            <NavLink
              my={2}
              label="Settings"
              component={Link}
              to="/settings"
              active={isActive("/settings")}
              onClick={handleClick}
              leftSection={<IconSettings size={16} stroke={1.5} />}
              styles={navItemStyles("/settings")}
            />
          </>
        ) : (
          <NavLink
            my={2}
            label="Login"
            component={Link}
            to="/login"
            active={isActive("/login")}
            onClick={handleClick}
            leftSection={<IconLogin size={16} stroke={1.5} />}
            styles={navItemStyles("/login")}
          />
        )}

        {viewingHandle && (
          <Box
            mt={4}
            px={12}
            py={8}
            style={{
              borderRadius: 12,
              background: "var(--mantine-color-default)",
              border: "1px solid var(--mantine-color-default-border)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <IconUser size={13} stroke={1.5} style={{ opacity: 0.5, flexShrink: 0 }} />
            <Box style={{ minWidth: 0 }}>
              <Text fz={9} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.08em" }}>
                Viewing profile
              </Text>
              <Text fz={12} fw={600} truncate>
                @{viewingHandle}
              </Text>
            </Box>
          </Box>
        )}
      </Box>

      {isLoggedIn && (
        <Box style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {friendsLoading ? (
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
          ) : (
            <>
              <FriendSection
                label="Moots"
                friends={friendsData?.moots ?? []}
                emptyText="No mutuals on Navyfragen yet."
                onLinkClick={handleClick}
              />
              <FriendSection
                label="Following"
                friends={friendsData?.following ?? []}
                emptyText="No one-sided follows on Navyfragen yet."
                onLinkClick={handleClick}
              />
              <FriendSection
                label="Oomfs"
                friends={friendsData?.oomfs ?? []}
                emptyText="None of your followers are on Navyfragen yet."
                onLinkClick={handleClick}
              />
            </>
          )}
        </Box>
      )}

      {!isLoggedIn && <Box style={{ flex: 1 }} />}
    </Box>
  );
}

const SECTION_OPEN_KEY = "navyfragen_friends_sections_open";

function getSectionOpen(label: string): boolean {
  try {
    const raw = localStorage.getItem(SECTION_OPEN_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    return parsed[label] !== false;
  } catch {
    return true;
  }
}

function setSectionOpen(label: string, open: boolean) {
  try {
    const raw = localStorage.getItem(SECTION_OPEN_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    localStorage.setItem(SECTION_OPEN_KEY, JSON.stringify({ ...parsed, [label]: open }));
  } catch {
    /* v8 ignore next */
  }
}

function FriendSection({
  label,
  friends,
  emptyText,
  onLinkClick,
}: {
  label: string;
  friends: Friend[];
  emptyText: string;
  onLinkClick: () => void;
}) {
  const [opened, { toggle }] = useDisclosure(getSectionOpen(label));
  const { triggerHaptic } = useHaptic(1);

  const handleToggle = () => {
    triggerHaptic();
    setSectionOpen(label, !opened);
    toggle();
  };

  return (
    <>
      <UnstyledButton
        onClick={handleToggle}
        mb="xs"
        px={2}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          width: "100%",
          cursor: "pointer",
          position: "sticky",
          top: 0,
          zIndex: 1,
          background: "var(--mantine-color-body)",
          paddingTop: "var(--mantine-spacing-lg)",
        }}
      >
        <Text
          size="xs"
          fw={700}
          c="dimmed"
          tt="uppercase"
          style={{ letterSpacing: "0.1em", flex: 1 }}
        >
          {label}
        </Text>
        <IconChevronDown
          size={12}
          style={{
            color: "var(--mantine-color-dimmed)",
            transition: "transform 150ms ease",
            transform: opened ? "rotate(0deg)" : "rotate(-90deg)",
            flexShrink: 0,
          }}
        />
      </UnstyledButton>
      <Collapse expanded={opened}>
        {friends.length > 0 ? (
          <Box style={{ overflowX: "hidden" }}>
            {friends.map((friend) => (
              <NavLink
                key={friend.did}
                label={
                  <Group gap={10} wrap="nowrap" style={{ overflow: "hidden", width: "100%" }}>
                    <Avatar
                      size={28}
                      radius="xl"
                      src={friend.avatar || undefined}
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
                }
                component={Link}
                to={`/profile/${friend.handle}`}
                onClick={onLinkClick}
                py={4}
                styles={friendNavLinkStyles}
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

/** Sunshine badge showing unread message count in the nav sidebar. */
function MessageCountBadge({ count }: { count: number }) {
  return (
    <span
      className="nf-pulse-dot"
      style={{
        background: "var(--nf-sunshine)",
        color: "var(--nf-midnight)",
        padding: "1px 7px",
        borderRadius: 999,
        fontFamily: "var(--nf-font-mono)",
        fontSize: 9,
        fontWeight: 700,
        lineHeight: 1.6,
      }}
    >
      {count}
    </span>
  );
}
