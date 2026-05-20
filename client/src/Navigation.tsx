import {
  IconHome,
  IconMessage,
  IconLogin,
  IconSettings,
} from "@tabler/icons-react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { NavLink, Text, Box, Skeleton, Stack, Avatar, Group, Button, CopyButton } from "@mantine/core";
import { useEffect } from "react";
import { useFriends } from "./api/profileService";
import { useUserStats } from "./api/settingsService";
import { WinkMark } from "./components/WinkMark";

const shortlinkurl = import.meta.env.VITE_SHORTLINK_URL || "localhost:5173/profile";

interface NavigationProps {
  onLinkClick?: () => void;
  isLoggedIn: boolean;
  handle?: string;
}

const activeNavStyle = {
  background: "linear-gradient(135deg, #3349E0 0%, #6B3FD4 55%, #4F1FA6 100%)",
  borderRadius: 12,
  color: "#FDF8FF",
  boxShadow: "0 6px 16px -8px rgba(107,63,212,0.6)",
};

export function Navigation({ onLinkClick, isLoggedIn, handle }: NavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: friendsData, isLoading: friendsLoading } = useFriends(isLoggedIn);
  const { data: userStats } = useUserStats();

  const handleClick = () => {
    if (onLinkClick) onLinkClick();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const targetNodeName = (event.target as HTMLElement)?.nodeName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(targetNodeName)) return;

      if (event.altKey) {
        let targetPath: string | null = null;
        switch (event.key.toUpperCase()) {
          case "H": targetPath = "/"; break;
          case "M": if (isLoggedIn) targetPath = "/messages"; break;
          case "S": if (isLoggedIn) targetPath = "/settings"; break;
          case "L": if (!isLoggedIn) targetPath = "/login"; break;
        }
        if (targetPath) {
          event.preventDefault();
          navigate(targetPath);
          if (onLinkClick) onLinkClick();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isLoggedIn, navigate, onLinkClick]);

  const isActive = (path: string) => location.pathname === path;

  const navItemStyles = (path: string) => ({
    root: isActive(path)
      ? activeNavStyle
      : { borderRadius: 12, transition: "background 120ms ease" },
  });

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
          leftSection={<IconHome size="1rem" stroke={1.5} />}
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
              leftSection={<IconMessage size="1rem" stroke={1.5} />}
              rightSection={
                !isActive("/messages") && (userStats?.messageCount ?? 0) > 0 ? (
                  <span style={{
                    background: "#FACC15",
                    color: "#1E1B4B",
                    padding: "1px 7px",
                    borderRadius: 999,
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 9,
                    fontWeight: 700,
                    lineHeight: 1.6,
                  }}>
                    {userStats!.messageCount}
                  </span>
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
              leftSection={<IconSettings size="1rem" stroke={1.5} />}
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
            leftSection={<IconLogin size="1rem" stroke={1.5} />}
            styles={navItemStyles("/login")}
          />
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
                    <Skeleton circle height={28} width={28} style={{ flexShrink: 0 }} />
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
                          <Text
                            size="sm"
                            fw={600}
                            truncate
                            style={{ fontFamily: "Inter", fontSize: 13, lineHeight: 1.3 }}
                          >
                            {friend.displayName || friend.handle}
                          </Text>
                          <Text
                            truncate
                            style={{
                              fontFamily: "JetBrains Mono, monospace",
                              fontSize: 10,
                              color: "var(--mantine-color-dimmed)",
                              lineHeight: 1.3,
                            }}
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
                    styles={{ root: { borderRadius: 10, transition: "background 120ms ease" } }}
                  />
                ))}
              </Box>
            ) : !friendsLoading ? (
              <Text size="xs" c="dimmed" px={2} style={{ lineHeight: 1.6 }}>
                None of the people you follow on Bluesky are on Navyfragen yet.
              </Text>
            ) : null}
          </Box>

          {/* Spread the word promo card */}
          <Box mt="md" style={{ flexShrink: 0 }}>
            <Box
              style={{
                padding: 12,
                borderRadius: 12,
                background: "var(--mantine-color-violet-0, rgba(139,92,246,0.10))",
                border: "1px solid var(--mantine-color-violet-2, rgba(139,92,246,0.25))",
              }}
            >
              <Text fw={700} size="sm">Spread the word</Text>
              <Text size="xs" c="dimmed" mt={4} style={{ lineHeight: 1.4 }}>
                Share your inbox link to get more questions.
              </Text>
              {handle ? (
                <CopyButton value={`https://${shortlinkurl}/${handle}`}>
                  {({ copied, copy }) => (
                    <Button
                      size="xs"
                      variant="gradient"
                      gradient={{ from: "royal", to: "purple", deg: 135 }}
                      fullWidth
                      mt={10}
                      onClick={copy}
                    >
                      {copied ? "Copied!" : "Copy my link"}
                    </Button>
                  )}
                </CopyButton>
              ) : (
                <Button
                  size="xs"
                  variant="gradient"
                  gradient={{ from: "royal", to: "purple", deg: 135 }}
                  fullWidth
                  mt={10}
                  component={Link}
                  to="/messages"
                  onClick={handleClick}
                >
                  Copy my link
                </Button>
              )}
            </Box>
          </Box>
        </>
      )}

      {!isLoggedIn && <Box style={{ flex: 1 }} />}
    </Box>
  );
}
