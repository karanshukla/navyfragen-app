import {
  ActionIcon,
  Box,
  Burger,
  Button,
  Flex,
  Group,
  Loader,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons-react";
import React from "react";
import { Link } from "react-router";
import { useHaptic } from "use-haptic";

import { useLogout, useSession } from "../api/authService";
import { useTranslations } from "../lib/i18n";
import { useHasBounceGap } from "../lib/useHasBounceGap";
import { BRAND_GRADIENT, surface, textDefault } from "../styles/tokens";

import { useBounceLogos } from "./BounceLogosContext";
import { UserMenu } from "./header/UserMenu";
import { UpdateAvailableButton } from "./UpdateAvailableButton";
import { Wordmark } from "./Wordmark";

interface AppHeaderProps {
  opened: boolean;
  onBurgerToggle: () => void;
  burgerRef: React.RefObject<HTMLButtonElement> | null;
  onNavClose: () => void;
}

const chipStyle = { background: surface, color: textDefault, border: "none" };

export function AppHeader({ opened, onBurgerToggle, burgerRef, onNavClose }: AppHeaderProps) {
  const messages = useTranslations();
  const { data: sessionData, isLoading } = useSession();
  const { mutate: logout } = useLogout();
  const { enabled: bounceLogosEnabled, setEnabled: setBounceLogosEnabled } = useBounceLogos();
  const hasBounceGap = useHasBounceGap();
  const { triggerHaptic } = useHaptic(1);

  const isLoggedIn = !!sessionData?.isLoggedIn;
  const userProfile = sessionData?.profile;

  const handleLogout = () => {
    try {
      document.body.style.pointerEvents = "none";
      document.body.style.opacity = "0.5";
      logout();
    } catch {
      document.body.style.pointerEvents = "";
      document.body.style.opacity = "";
    }
    onNavClose();
  };

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
        style={{ textDecoration: "none", display: "flex", alignItems: "center" }}
      >
        <Wordmark size={18} />
      </Box>

      <UpdateAvailableButton />

      <Flex gap="sm" justify="flex-end" align="center" style={{ flexGrow: 1 }}>
        {hasBounceGap && (
          <Button
            onClick={() => {
              triggerHaptic();
              setBounceLogosEnabled(!bounceLogosEnabled);
            }}
            variant="default"
            size="xs"
            radius="xl"
            style={chipStyle}
          >
            {bounceLogosEnabled
              ? messages.appHeader.disableAnimations
              : messages.appHeader.enableAnimations}
          </Button>
        )}

        <ColorSchemeToggle />

        {isLoading ? (
          <Loader size="sm" />
        ) : isLoggedIn && userProfile ? (
          <UserMenu
            userProfile={userProfile}
            accounts={sessionData?.accounts ?? []}
            activeDid={sessionData?.did ?? undefined}
            onLogout={handleLogout}
            onNavigate={onNavClose}
          />
        ) : (
          <Button
            component={Link}
            to="/login"
            variant="gradient"
            gradient={BRAND_GRADIENT}
            size="xs"
            onClick={() => {
              triggerHaptic();
              onNavClose();
            }}
          >
            {messages.common.shortcuts.login}
          </Button>
        )}
      </Flex>
    </Group>
  );
}

function ColorSchemeToggle() {
  const { toggleColorScheme } = useMantineColorScheme();
  const { triggerHaptic } = useHaptic(1);
  const messages = useTranslations();
  const isDark = useComputedColorScheme("light", { getInitialValueInEffect: true }) === "dark";

  return (
    <ActionIcon
      onClick={() => {
        triggerHaptic();
        toggleColorScheme();
      }}
      aria-label={messages.appHeader.toggleColorScheme}
      size={36}
      radius="xl"
      variant="transparent"
      style={chipStyle}
    >
      {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
    </ActionIcon>
  );
}
