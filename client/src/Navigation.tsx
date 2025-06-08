import {
  IconHome,
  IconMessage,
  IconLogin,
  IconButterfly,
  IconSettings,
} from "@tabler/icons-react";
import { useLocation, Link, useNavigate } from "react-router-dom"; // Added useNavigate
import { Divider, NavLink, Text, Box } from "@mantine/core";
import { useEffect } from "react"; // Added useEffect

interface NavigationProps {
  onLinkClick?: () => void;
  isLoggedIn: boolean;
}

export function Navigation({ onLinkClick, isLoggedIn }: NavigationProps) {
  const location = useLocation();
  const navigate = useNavigate(); // Added for keyboard navigation

  const handleClick = () => {
    if (onLinkClick) {
      onLinkClick();
    }
  };

  // Keyboard shortcuts effect
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if the event target is an input, textarea, or select to avoid conflicts
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
            onLinkClick(); // Close mobile navbar if open
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLoggedIn, navigate, onLinkClick]);

  // Helper component for shortcut hints
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
          component={Link}
          to="https://bsky.app/profile/navyfragen.app"
          onClick={handleClick} // Added onClick to close navbar on mobile
          leftSection={<IconButterfly size="1rem" stroke={1.5} />}
        />
      </Box>
    </Box>
  );
}
