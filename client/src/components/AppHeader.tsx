import {
  ActionIcon,
  Avatar,
  Box,
  Burger,
  Button,
  Flex,
  Group,
  Loader,
  Menu,
  Text,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { IconLogout, IconMoon, IconSun, IconUser } from "@tabler/icons-react";
import React from "react";
import { Link } from "react-router-dom";

import { useSession, useLogout } from "../api/authService";
import { surfaceBg } from "../styles/tokens";

import { WinkMark } from "./WinkMark";
import { Wordmark } from "./Wordmark";

interface AppHeaderProps {
  opened: boolean;
  onBurgerToggle: () => void;
  burgerRef: React.RefObject<HTMLButtonElement> | null;
  onNavClose: () => void;
}

export function AppHeader({
  opened,
  onBurgerToggle,
  burgerRef,
  onNavClose,
}: AppHeaderProps) {
  const { data: sessionData, isLoading } = useSession();
  const { mutate: logout } = useLogout();
  const { toggleColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  const isDark = computedColorScheme === "dark";
  const isLoggedIn = !!sessionData?.isLoggedIn;
  const userProfile = sessionData?.profile;

  return (
    <Group h="100%" px="md">
      <Burger
        ref={burgerRef}
        opened={opened}
        onClick={onBurgerToggle}
        hiddenFrom="sm"
        size="sm"
      />
      <Box
        component={Link}
        to="/"
        style={{
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Wordmark size={18} />
      </Box>

      <Flex gap="sm" justify="flex-end" align="center" style={{ flexGrow: 1 }}>
        <ActionIcon
          onClick={() => toggleColorScheme()}
          aria-label="Toggle color scheme"
          size={36}
          radius="xl"
          variant="transparent"
          style={{
            background: surfaceBg(isDark),
            color: "var(--mantine-color-text)",
          }}
        >
          {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
        </ActionIcon>

        {isLoading ? (
          <Loader size="sm" />
        ) : isLoggedIn && userProfile ? (
          <UserMenu
            userProfile={userProfile}
            isDark={isDark}
            onLogout={() => {
              try {
                document.body.style.pointerEvents = "none";
                document.body.style.opacity = "0.5";
                logout();
              /* v8 ignore next 4 */
              } catch {
                document.body.style.pointerEvents = "";
                document.body.style.opacity = "";
              }
              onNavClose();
            }}
            onNavigate={onNavClose}
          />
        ) : (
          <Button
            component={Link}
            to="/login"
            variant="gradient"
            gradient={{ from: "royal", to: "purple", deg: 135 }}
            size="xs"
            onClick={onNavClose}
          >
            Login
          </Button>
        )}
      </Flex>
    </Group>
  );
}

interface UserMenuProps {
  userProfile: {
    avatar?: string | null;
    displayName?: string | null;
    handle?: string;
  };
  isDark: boolean;
  onLogout: () => void;
  onNavigate: () => void;
}

function UserMenu({
  userProfile,
  isDark,
  onLogout,
  onNavigate,
}: UserMenuProps) {
  return (
    <Menu
      shadow="md"
      width={180}
      position="bottom-end"
      middlewares={{ shift: true, flip: true }}
      styles={{
        item: { padding: "12px 16px", fontSize: "var(--mantine-font-size-sm)" },
      }}
    >
      <Menu.Target>
        <Button
          variant="transparent"
          px={8}
          radius="xl"
          style={{
            background: surfaceBg(isDark),
            height: 36,
            color: "var(--mantine-color-text)",
          }}
        >
          <Group gap="xs">
            <Avatar
              size={28}
              src={userProfile.avatar || undefined}
              alt={userProfile.displayName || "User Avatar"}
              radius="xl"
            >
              <WinkMark size={22} sparkle={false} aria-hidden />
            </Avatar>
            <Box visibleFrom="sm">
              <Text size="sm" fw={600} truncate>
                {userProfile.displayName}
              </Text>
            </Box>
          </Group>
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item
          component={Link}
          to={`/profile/${userProfile.handle}`}
          onClick={onNavigate}
          leftSection={<IconUser size="1.2rem" stroke={1.5} />}
        >
          View Profile
        </Menu.Item>
        <Menu.Item
          onClick={onLogout}
          leftSection={<IconLogout size="1.2rem" stroke={1.5} />}
        >
          Logout
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
