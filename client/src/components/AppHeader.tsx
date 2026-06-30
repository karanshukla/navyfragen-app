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
import { showNotification } from "@mantine/notifications";
import { IconCheck, IconLogout, IconMoon, IconPlus, IconSun, IconUser } from "@tabler/icons-react";
import React from "react";
import { Link } from "react-router-dom";
import { useHaptic } from "use-haptic";

import { type AccountEntry, useLogout, useSession, useSwitchAccount } from "../api/authService";
import { surfaceBg } from "../styles/tokens";

import { WinkMark } from "./WinkMark";
import { Wordmark } from "./Wordmark";

interface AppHeaderProps {
  opened: boolean;
  onBurgerToggle: () => void;
  burgerRef: React.RefObject<HTMLButtonElement> | null;
  onNavClose: () => void;
}

export function AppHeader({ opened, onBurgerToggle, burgerRef, onNavClose }: AppHeaderProps) {
  const { data: sessionData, isLoading } = useSession();
  const { mutate: logout } = useLogout();
  const { toggleColorScheme } = useMantineColorScheme();
  const { triggerHaptic } = useHaptic(1);
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  const isDark = computedColorScheme === "dark";
  const isLoggedIn = !!sessionData?.isLoggedIn;
  const userProfile = sessionData?.profile;
  const accounts = sessionData?.accounts ?? [];
  const activeDid = sessionData?.did ?? undefined;

  return (
    <Group h="100%" px="md">
      <Burger
        ref={burgerRef}
        opened={opened}
        onClick={() => {
          triggerHaptic();
          onBurgerToggle();
        }}
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
          onClick={() => {
            triggerHaptic();
            toggleColorScheme();
          }}
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
            accounts={accounts}
            activeDid={activeDid}
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
            onClick={() => {
              triggerHaptic();
              onNavClose();
            }}
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
  accounts: AccountEntry[];
  activeDid?: string;
  isDark: boolean;
  onLogout: () => void;
  onNavigate: () => void;
}

function UserMenu({
  userProfile,
  accounts,
  activeDid,
  isDark,
  onLogout,
  onNavigate,
}: UserMenuProps) {
  const { triggerHaptic } = useHaptic(1);
  const { mutate: switchAccount, isPending: isSwitching } = useSwitchAccount();
  const hasMultiple = accounts.length > 1;

  const handleSwitch = (did: string, label: string) => {
    if (did === activeDid || isSwitching) return;
    triggerHaptic();
    switchAccount(
      { did },
      {
        onSuccess: () => {
          showNotification({
            message: `Switched to @${label}`,
            color: "green",
          });
          onNavigate();
        },
        onError: (err: any) => {
          showNotification({
            title: "Couldn't switch account",
            message: err?.error || "Please try again.",
            color: "red",
          });
        },
      }
    );
  };

  return (
    <Menu
      shadow="md"
      width={260}
      position="bottom-end"
      middlewares={{ shift: true, flip: true }}
      styles={{
        item: { padding: "10px 14px", fontSize: "var(--mantine-font-size-sm)" },
        itemLabel: { overflow: "hidden" },
      }}
    >
      <Menu.Target>
        <Button
          onClick={triggerHaptic}
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
              <Text size="sm" fw={600} truncate maw={120}>
                {userProfile.displayName}
              </Text>
            </Box>
          </Group>
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        {/* Account switcher — only shown when more than one account is signed in. */}
        {hasMultiple && (
          <>
            <Menu.Label>Accounts</Menu.Label>
            {accounts.map((acct) => {
              const isActive = acct.did === activeDid;
              const label = acct.displayName || acct.handle || acct.did;
              return (
                <Menu.Item
                  key={acct.did}
                  disabled={isActive || isSwitching}
                  onClick={() => handleSwitch(acct.did, acct.handle || label)}
                  leftSection={
                    <Avatar size={20} src={acct.avatar || undefined} radius="xl">
                      {(acct.handle || "?").charAt(0).toUpperCase()}
                    </Avatar>
                  }
                  rightSection={isActive ? <IconCheck size={14} stroke={2.5} /> : undefined}
                >
                  <Box style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
                    <Text size="sm" fw={500} truncate>
                      {label}
                    </Text>
                    {acct.handle && (
                      <Text size="xs" c="dimmed" truncate>
                        @{acct.handle}
                      </Text>
                    )}
                  </Box>
                </Menu.Item>
              );
            })}
            <Menu.Divider />
          </>
        )}

        <Menu.Item
          component={Link}
          to={`/profile/${userProfile.handle}`}
          onClick={() => {
            triggerHaptic();
            onNavigate();
          }}
          leftSection={<IconUser size="1.2rem" stroke={1.5} />}
        >
          View Profile
        </Menu.Item>

        {/* Add another Bluesky account via OAuth. */}
        <Menu.Item
          component={Link}
          to="/login?add=1"
          onClick={() => {
            triggerHaptic();
            onNavigate();
          }}
          leftSection={<IconPlus size="1.2rem" stroke={1.5} />}
        >
          Add account
        </Menu.Item>

        <Menu.Item
          onClick={() => {
            triggerHaptic();
            onLogout();
          }}
          leftSection={<IconLogout size="1.2rem" stroke={1.5} />}
        >
          {`Log out @${userProfile.handle}`}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
