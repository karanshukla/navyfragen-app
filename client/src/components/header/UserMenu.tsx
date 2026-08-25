import { Avatar, Box, Button, Group, Menu, Text } from "@mantine/core";
import { showNotification } from "@mantine/notifications";
import { IconCheck, IconLogout, IconPlus, IconUser } from "@tabler/icons-react";
import { Link } from "react-router";
import { useHaptic } from "use-haptic";

import { ApiError } from "../../api/apiClient";
import { type AccountEntry, useSwitchAccount } from "../../api/authService";
import { buildAccountSwitchUrl } from "../../lib/accountSwitchToast";
import { useTranslations } from "../../lib/i18n";
import { resolveApiErrorMessage } from "../../lib/i18n/apiErrors";
import { WinkMark } from "../WinkMark";

import * as styles from "./UserMenu.styles";

interface UserMenuProps {
  userProfile: {
    avatar?: string | null;
    displayName?: string | null;
    handle?: string;
  };
  accounts: AccountEntry[];
  activeDid?: string;
  onLogout: () => void;
  onNavigate: () => void;
}

export function UserMenu({
  userProfile,
  accounts,
  activeDid,
  onLogout,
  onNavigate,
}: UserMenuProps) {
  const { triggerHaptic } = useHaptic(1);
  const messages = useTranslations();
  const { mutate: switchAccount, isPending: isSwitching } = useSwitchAccount();
  const showsAccountsLabel = accounts.length > 1;

  const handleSwitch = (did: string, handle: string) => {
    /* istanbul ignore if */
    if (did === activeDid || isSwitching) return;
    triggerHaptic();

    /* istanbul ignore next */
    try {
      document.body.style.pointerEvents = "none";
      document.body.style.opacity = "0.5";
    } catch {
      document.body.style.pointerEvents = "";
      document.body.style.opacity = "";
    }

    switchAccount(
      { did },
      {
        onSuccess: () => {
          window.location.href = buildAccountSwitchUrl(handle);
        },
        onError: (err: ApiError) => {
          showNotification({
            title: messages.userMenu.switchAccountErrorTitle,
            message: resolveApiErrorMessage(err, messages),
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
      styles={styles.menu}
    >
      <Menu.Target>
        <Button
          onClick={triggerHaptic}
          variant="transparent"
          px={8}
          radius="xl"
          style={styles.trigger}
        >
          <Group gap="xs">
            <Avatar
              size={28}
              src={userProfile.avatar || undefined}
              alt={userProfile.displayName || messages.userMenu.userAvatarAltFallback}
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
        {/* The active profile row always renders above "Add account", even with
            one account signed in. */}
        {accounts.length > 0 && (
          <>
            {showsAccountsLabel && <Menu.Label>{messages.userMenu.accountsLabel}</Menu.Label>}
            {accounts.map((acct) => {
              const isActive = acct.did === activeDid;
              return (
                <Menu.Item
                  key={acct.did}
                  disabled={isActive || isSwitching}
                  onClick={() => handleSwitch(acct.did, acct.handle || acct.did)}
                  leftSection={
                    <Avatar size={20} src={acct.avatar || undefined} radius="xl">
                      {(acct.handle || "?").charAt(0).toUpperCase()}
                    </Avatar>
                  }
                  rightSection={isActive ? <IconCheck size={14} stroke={2.5} /> : undefined}
                >
                  <Box style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
                    <Text size="sm" fw={500} truncate>
                      {acct.displayName || acct.handle || acct.did}
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
          to="/login?add=1"
          onClick={() => {
            triggerHaptic();
            onNavigate();
          }}
          leftSection={<IconPlus size="1.2rem" stroke={1.5} />}
        >
          {messages.userMenu.addAccount}
        </Menu.Item>

        <Menu.Divider />

        <Menu.Item
          component={Link}
          to={`/profile/${userProfile.handle}`}
          onClick={() => {
            triggerHaptic();
            onNavigate();
          }}
          leftSection={<IconUser size="1.2rem" stroke={1.5} />}
        >
          {messages.userMenu.viewProfile}
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
