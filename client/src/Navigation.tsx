import {
  IconHome,
  IconMessage,
  IconLogin,
  IconButterfly,
  IconSettings,
} from "@tabler/icons-react";
import { useLocation, Link } from "react-router-dom";
import { Divider, NavLink, Text, Box } from "@mantine/core";

interface UserProfile {
  did?: string;
  displayName?: string;
  description?: string;
  avatar?: string;
}

interface NavigationProps {
  onLinkClick?: () => void;
  isLoggedIn: boolean;
  userProfile: UserProfile | null;
}

export function Navigation({ onLinkClick, isLoggedIn }: NavigationProps) {
  const location = useLocation();

  const handleClick = () => {
    if (onLinkClick) {
      onLinkClick();
    }
  };

  return (
    <Box style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box style={{ flexGrow: 1 }}>
        <NavLink
          my="xs"
          label="Home"
          component={Link}
          to="/"
          active={location.pathname === "/"}
          onClick={handleClick}
          leftSection={<IconHome size="1rem" stroke={1.5} />}
        />{" "}
        {isLoggedIn ? (
          <>
            {" "}
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
          <>
            <NavLink
              my="xs"
              label="Login"
              component={Link}
              to="/login"
              active={location.pathname === "/login"}
              onClick={handleClick}
              leftSection={<IconLogin size="1rem" stroke={1.5} />}
            />
          </>
        )}
      </Box>
      <Box>
        <Divider />
        <Text size="xs" my="md" ta="center">
          Questions? Feedback? Reach out on Bluesky
        </Text>
        <NavLink
          label="@navyfragen.app"
          component={Link}
          to="https://bsky.app/profile/navyfragen.app"
          leftSection={<IconButterfly size="1rem" stroke={1.5} />}
        />
      </Box>
    </Box>
  );
}
