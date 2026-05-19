import {
  IconHome,
  IconMessage,
  IconLogin,
  IconButterfly,
  IconSettings,
} from "@tabler/icons-react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { Divider, NavLink, Text, Box, Skeleton, Stack, Avatar, Group, Anchor } from "@mantine/core";
import { useEffect, useState } from "react";
import { useFriends } from "./api/profileService";

interface NavigationProps {
  onLinkClick?: () => void;
  isLoggedIn: boolean;
}

const FRIENDS_PAGE_SIZE = 10;

export function Navigation({ onLinkClick, isLoggedIn }: NavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: friendsData, isLoading: friendsLoading } = useFriends(isLoggedIn);
  const [friendsVisible, setFriendsVisible] = useState(FRIENDS_PAGE_SIZE);

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

  const ShortcutHint = ({ label, hint }: { label: string; hint: string }) => (
    <Box
      visibleFrom="sm"
      style={{
        display: "flex",
        justifyContent: "space-between",
        width: "100%",
      }}
    >
      <Text size="xs">{label}</Text>
      <Text size="xs" c="dimmed">
        {hint.replace("Alt", "Alt/Cmd")}
      </Text>
    </Box>
  );

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
        <Box mt="md">
          <Divider mb="md" />
          <Text size="xs" fw={600} c="dimmed" mb="xs" tt="uppercase" style={{ letterSpacing: "0.05em" }}>
            How it works
          </Text>
          {isLoggedIn ? (
            <Text size="xs" c="dimmed" style={{ lineHeight: 1.6 }}>
              Share your profile link and anyone can send you an anonymous
              question. Read incoming questions in your Messages inbox, then
              reply to post your answer directly to your Bluesky feed.
            </Text>
          ) : (
            <Text size="xs" c="dimmed" style={{ lineHeight: 1.6 }}>
              Log in with your Bluesky account to get a personal profile link.
              Share it anywhere and people can send you anonymous questions.
              You read and reply to them here, and your answers post straight
              to Bluesky.
            </Text>
          )}
        </Box>
        {isLoggedIn && (
          <Box mt="md">
            <Divider mb="md" />
            <Text size="xs" fw={600} c="dimmed" mb="xs" tt="uppercase" style={{ letterSpacing: "0.05em" }}>
              Friends on Navyfragen
            </Text>
          </Box>
        )}
      </Box>

      {/* Scrollable friends list */}
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
            <Box style={{ overflowX: "hidden" }} pb="xs">
              {friendsData.friends.slice(0, friendsVisible).map((friend) => (
                <NavLink
                  key={friend.did}
                  label={
                    <Group gap="xs" wrap="nowrap" style={{ overflow: "hidden", width: "100%" }}>
                      <Avatar size={20} radius="xl" src={friend.avatar || undefined} style={{ flexShrink: 0 }} />
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
              {friendsData.friends.length > friendsVisible && (
                <Anchor
                  size="xs"
                  c="blue"
                  fw={500}
                  mt={4}
                  style={{ display: "block", cursor: "pointer" }}
                  onClick={() => setFriendsVisible((v) => v + FRIENDS_PAGE_SIZE)}
                >
                  ↓ Load {friendsData.friends.length - friendsVisible} more
                </Anchor>
              )}
              {friendsVisible > FRIENDS_PAGE_SIZE && (
                <Anchor
                  size="xs"
                  c="blue"
                  fw={500}
                  mt={4}
                  style={{ display: "block", cursor: "pointer" }}
                  onClick={() => setFriendsVisible(FRIENDS_PAGE_SIZE)}
                >
                  ↑ Show less
                </Anchor>
              )}
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

      {/* Fixed bottom: keyboard shortcuts, Bluesky link */}
      <Box style={{ flexShrink: 0 }}>
        <Divider visibleFrom="sm" mt="xl" />
        <Box mt="md" mb="md" visibleFrom="sm">
          <Text size="sm" c="dimmed" mb="xs">
            Keyboard Shortcuts:
          </Text>
          <ShortcutHint label="Home" hint="Alt+H" />
          {isLoggedIn ? (
            <>
              <ShortcutHint label="Messages" hint="Alt+M" />
              <ShortcutHint label="Settings" hint="Alt+S" />
              <ShortcutHint label="Focus/Cycle Cards" hint="Alt+R" />
              <ShortcutHint label="Navigate Cards" hint="↑/↓" />
            </>
          ) : (
            <ShortcutHint label="Login" hint="Alt+L" />
          )}
        </Box>
        <Divider />
        <Text size="xs" my="md" ta="center">
          Questions? Feedback? Reach out on Bluesky
        </Text>
        <NavLink
          label="@navyfragen.app"
          component="a"
          href="https://bsky.app/profile/navyfragen.app"
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          leftSection={<IconButterfly size="1rem" stroke={1.5} />}
        />
      </Box>
    </Box>
  );
}
