import {
  IconHome,
  IconMessage,
  IconLogin,
  IconSettings,
} from "@tabler/icons-react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { Divider, NavLink, Text, Box, Skeleton, Stack, Avatar, Group } from "@mantine/core";
import { useEffect } from "react";
import { useMediaQuery } from "@mantine/hooks";
import { useFriends } from "./api/profileService";

interface NavigationProps {
  onLinkClick?: () => void;
  isLoggedIn: boolean;
}

export function Navigation({ onLinkClick, isLoggedIn }: NavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMd = useMediaQuery("(min-width: 62em)");
  const isLg = useMediaQuery("(min-width: 75em)");
  const avatarSize = isLg ? 26 : isMd ? 22 : 20;
  const { data: friendsData, isLoading: friendsLoading } = useFriends(isLoggedIn);

  const handleClick = () => {
    if (onLinkClick) {
      onLinkClick();
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const targetNodeName = (event.target as HTMLElement)?.nodeName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(targetNodeName)) {
        return;
      }

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
          default:
            break;
        }

        if (targetPath) {
          event.preventDefault();
          navigate(targetPath);
          if (onLinkClick) {
            onLinkClick();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLoggedIn, navigate, onLinkClick]);

  return (
    <Box style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Fixed top: nav links, how it works, friends header */}
      <Box style={{ flexShrink: 0 }}>
        <NavLink
          my="xs"
          label="Home"
          component={Link}
          to="/"
          active={location.pathname === "/"}
          onClick={handleClick}
          leftSection={<IconHome size="1rem" stroke={1.5} />}
        />
        {isLoggedIn ? (
          <>
            <NavLink
              my="xs"
              label="Messages"
              component={Link}
              to="/messages"
              active={location.pathname === "/messages"}
              onClick={handleClick}
              leftSection={<IconMessage size="1rem" stroke={1.5} />}
            />
            <Divider />
            <NavLink
              my="xs"
              label="Settings"
              component={Link}
              to="/settings"
              active={location.pathname === "/settings"}
              onClick={handleClick}
              leftSection={<IconSettings size="1rem" stroke={1.5} />}
            />
          </>
        ) : (
          <NavLink
            my="xs"
            label="Login"
            component={Link}
            to="/login"
            active={location.pathname === "/login"}
            onClick={handleClick}
            leftSection={<IconLogin size="1rem" stroke={1.5} />}
          />
        )}
        {isLoggedIn && (
          <Box mt="md">
            <Divider mb="md" />
            <Text size="xs" fw={600} c="dimmed" mb="xs" tt="uppercase" style={{ letterSpacing: "0.05em" }}>
              Friends on Navyfragen
            </Text>
          </Box>
        )}
      </Box>

      {/* Scrollable friends list — rows only */}
      {isLoggedIn && (
        <Box style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {friendsLoading ? (
            <Stack gap={6}>
              {[0, 1, 2].map((i) => (
                <Group key={i} gap="xs" px={4} py={4}>
                  <Skeleton circle height={20} width={20} style={{ flexShrink: 0 }} />
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
                    <Group gap="xs" wrap="nowrap" style={{ overflow: "hidden", width: "100%" }}>
                      <Avatar size={avatarSize} radius="xl" src={friend.avatar || undefined} style={{ flexShrink: 0 }} />
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Text size="xs" truncate>
                          {friend.displayName || friend.handle}
                        </Text>
                        <Text size="xs" c="dimmed" truncate>
                          @{friend.handle}
                        </Text>
                      </Box>
                    </Group>
                  }
                  component={Link}
                  to={`/profile/${friend.handle}`}
                  onClick={handleClick}
                  py={4}
                />
              ))}
            </Box>
          ) : !friendsLoading ? (
            <Text size="xs" c="dimmed" style={{ lineHeight: 1.6 }}>
              None of the people you follow on Bluesky are on Navyfragen yet.
            </Text>
          ) : null}
        </Box>
      )}

      {/* Spacer when logged out keeps the bottom section pinned */}
      {!isLoggedIn && <Box style={{ flex: 1 }} />}

    </Box>
  );
}
