import {
  NavLink,
  Text,
  Box,
  Skeleton,
  Stack,
  Avatar,
  Group,
  Button,
  CopyButton,
} from "@mantine/core";
import {
  IconHome,
  IconMessage,
  IconLogin,
  IconSettings,
  IconUser,
} from "@tabler/icons-react";
import { useEffect } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";

import { useFriends } from "./api/profileService";
import { useUserStats } from "./api/settingsService";
import { WinkMark } from "./components/WinkMark";

const shortlinkurl =
  import.meta.env.VITE_SHORTLINK_URL || "localhost:5173/profile";

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

// Module-level to avoid recreating objects on every render
const friendNavLinkStyles = {
  root: { borderRadius: 10, transition: "background 120ms ease" },
};

export function Navigation({
  onLinkClick,
  isLoggedIn,
  handle,
  did,
}: NavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: friendsData, isLoading: friendsLoading } = useFriends(
    isLoggedIn ? (did ?? null) : null,
  );
  const { data: userStats } = useUserStats();

  const handleClick = () => onLinkClick?.();

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
            <IconUser
              size={13}
              stroke={1.5}
              style={{ opacity: 0.5, flexShrink: 0 }}
            />
            <Box style={{ minWidth: 0 }}>
              <Text
                ff="monospace"
                fz={9}
                tt="uppercase"
                c="dimmed"
                style={{ letterSpacing: "0.08em" }}
              >
                Viewing profile
              </Text>
              <Text ff="monospace" fz={12} fw={600} truncate>
                @{viewingHandle}
              </Text>
            </Box>
          </Box>
        )}
      </Box>

      {isLoggedIn && (
        <>
          <Box mt="lg" mb="xs" px={2}>
            <Text
              size="xs"
              fw={700}
              c="dimmed"
              tt="uppercase"
              ff="monospace"
              style={{ letterSpacing: "0.1em" }}
            >
              Friends on Navyfragen
            </Text>
          </Box>

          <Box style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {friendsLoading ? (
              <Stack gap={6}>
                {[0, 1, 2].map((i) => (
                  <Group key={i} gap="xs" px={4} py={4}>
                    <Skeleton
                      circle
                      height={28}
                      width={28}
                      style={{ flexShrink: 0 }}
                    />
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Skeleton height={10} mb={4} radius="sm" />
                      <Skeleton height={8} width="60%" radius="sm" />
                    </Box>
                  </Group>
                ))}
              </Stack>
            ) : friendsData?.friends && friendsData.friends.length > 0 ? (
              <Box style={{ overflowX: "hidden" }}>
                {friendsData.friends.map((friend) => (
                  <NavLink
                    key={friend.did}
                    label={
                      <Group
                        gap={10}
                        wrap="nowrap"
                        style={{ overflow: "hidden", width: "100%" }}
                      >
                        <Avatar
                          size={28}
                          radius="xl"
                          src={friend.avatar || undefined}
                          style={{ flexShrink: 0 }}
                        >
                          <WinkMark size={22} sparkle={false} aria-hidden />
                        </Avatar>
                        <Box style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            fz={13}
                            fw={600}
                            truncate
                            style={{ lineHeight: 1.3 }}
                          >
                            {friend.displayName || friend.handle}
                          </Text>
                          <Text
                            ff="monospace"
                            fz={10}
                            c="dimmed"
                            truncate
                            style={{ lineHeight: 1.3 }}
                          >
                            @{friend.handle}
                          </Text>
                        </Box>
                      </Group>
                    }
                    component={Link}
                    to={`/profile/${friend.handle}`}
                    onClick={handleClick}
                    py={4}
                    styles={friendNavLinkStyles}
                  />
                ))}
              </Box>
            ) : !friendsLoading ? (
              <Text size="xs" c="dimmed" px={2} style={{ lineHeight: 1.6 }}>
                None of the people you follow on Bluesky are on Navyfragen yet.
              </Text>
            ) : /* v8 ignore next */ null}
          </Box>
        </>
      )}

      {!isLoggedIn && <Box style={{ flex: 1 }} />}
    </Box>
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
