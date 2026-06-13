import {
  Title,
  Grid,
  SimpleGrid,
  Paper,
  Text,
  Button,
  Switch,
  Alert,
  Skeleton,
  Loader,
  Stack,
  useComputedColorScheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";

import { apiClient, ApiError } from "../api/apiClient";
import { useSession } from "../api/authService";
import { useBotFollow } from "../api/profileService";
import {
  useUserSettings,
  useUpdateUserSettings,
  useUserStats,
  usePdsInfo,
} from "../api/settingsService";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { useInstallPrompt } from "../components/InstallPromptContext";
import { SettingsCard } from "../components/SettingsCard";

// Stat display sizes — intentionally different to create visual hierarchy
const STAT_SIZE_LARGE = 32;
const STAT_SIZE_MEDIUM = 22;
const STAT_SIZE_SMALL = 13;

export default function Settings() {
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });
  const isDark = computedColorScheme === "dark";

  const { data: session, isLoading: sessionLoading } = useSession();
  const {
    data: userSettings,
    isLoading: settingsLoading,
    error: settingsError,
    refetch: refetchSettings,
  } = useUserSettings();
  const updateSettings = useUpdateUserSettings({
    onSuccess: () => {},
    onError: (error: ApiError) => {
      notifications.show({
        title: "Update Failed",
        message: error.error || "Failed to update settings. Please try again.",
        color: "red",
      });
    },
  });
  const { data: userStats, isLoading: statsLoading } = useUserStats();
  const { data: pdsInfo, isLoading: pdsLoading } = usePdsInfo();
  const { installPrompt, setInstallPrompt } = useInstallPrompt();
  const { data: botFollowData, isLoading: botFollowLoading } = useBotFollow(
    Boolean(session?.isLoggedIn),
  );

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
  };

  const settingsLoadError = (
    <Alert color="red" title="Failed to load settings" withCloseButton={false}>
      <Button size="xs" onClick={() => refetchSettings()} variant="light" mt="xs">
        Retry
      </Button>
    </Alert>
  );

  return (
    <>
      {!session?.isLoggedIn && !sessionLoading ? (
        <Alert title="Error" color="red">
          You cannot access this page without logging in.
        </Alert>
      ) : (
        <>
          <Title order={1} mb="xl" style={{ letterSpacing: "-0.03em" }}>
            Settings
          </Title>

          <Grid gutter="md">
            {/* Account overview — full-width stats panel */}
            <Grid.Col span={12}>
              <Paper
                withBorder
                style={{
                  borderRadius: 14,
                  padding: 24,
                  background: isDark ? "rgba(255,255,255,0.06)" : "#F2EBFF",
                }}
              >
                <Text fw={700} fz={18} mb={18}>
                  Account Overview
                </Text>
                {statsLoading || pdsLoading ? (
                  <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xl">
                    {[0, 1, 2, 3].map((i) => (
                      <Stack key={i} gap={4}>
                        <Skeleton height={28} width="60%" radius="sm" />
                        <Skeleton height={12} width="80%" radius="sm" />
                      </Stack>
                    ))}
                  </SimpleGrid>
                ) : (
                  <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xl" style={{ alignItems: "flex-end" }}>
                    <StatItem
                      value={userStats?.messageCount ?? "—"}
                      label="Messages in inbox"
                      size={STAT_SIZE_LARGE}
                    />
                    <StatItem
                      value={pdsInfo?.recordCount ?? "—"}
                      label="Answers on PDS"
                      size={STAT_SIZE_LARGE}
                    />
                    <StatItem
                      value={
                        userStats?.memberSince
                          ? new Date(userStats.memberSince).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"
                      }
                      label="Active since"
                      size={STAT_SIZE_MEDIUM}
                    />
                    <StatItem
                      value={pdsInfo?.pdsUrl ? pdsInfo.pdsUrl.replace(/^https?:\/\//, "") : "—"}
                      label="PDS"
                      size={STAT_SIZE_SMALL}
                      truncate
                    />
                  </SimpleGrid>
                )}
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6, lg: 4 }} style={{ display: "flex" }}>
              <SettingsCard
                title="Install Application"
                description="Install the app for faster access. Works with almost any device you own, including tablets and laptops. Uninstall the app anytime. On iOS or Android, it will be added to your home screen and run with the same browser."
                isDark={isDark}
              >
                <Button
                  onClick={handleInstallClick}
                  fullWidth
                  disabled={!installPrompt}
                  title={!installPrompt ? "Refresh the page to enable install" : ""}
                  variant="gradient"
                  gradient={{ from: "royal", to: "purple", deg: 135 }}
                >
                  Install Navyfragen
                </Button>
              </SettingsCard>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6, lg: 4 }} style={{ display: "flex" }}>
              <SettingsCard
                title="PDS Sync"
                description="By default, Navyfragen syncs your anonymous messages with your Bluesky PDS (Personal Data Server). Disable this if you wish to keep your data on Navyfragen's servers. Will not change your ability to post to Bluesky directly."
                isDark={isDark}
              >
                {settingsLoading ? (
                  <Loader size="sm" />
                ) : settingsError ? (
                  settingsLoadError
                ) : (
                  <Switch
                    size="lg"
                    label="Enable PDS Sync"
                    checked={Boolean(userSettings?.pdsSyncEnabled)}
                    onChange={(event) => {
                      updateSettings.mutate({
                        pdsSyncEnabled: event.currentTarget.checked,
                        imageTheme: userSettings?.imageTheme || "default",
                      });
                    }}
                    disabled={updateSettings.isPending}
                    styles={{
                      label: { opacity: 1, color: "inherit" },
                      track: { opacity: updateSettings.isPending ? 0.7 : 1 },
                      thumb: { opacity: updateSettings.isPending ? 0.7 : 1 },
                    }}
                  />
                )}
              </SettingsCard>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6, lg: 4 }} style={{ display: "flex" }}>
              <SettingsCard
                title="Push Notifications"
                description="Receive a push notification of new messages. Accept your browser or phone's notification prompt to enable. Clearing your site data will disable this option."
                isDark={isDark}
              >
                <Button fullWidth disabled variant="outline">
                  Coming Soon
                </Button>
              </SettingsCard>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6, lg: 4 }} style={{ display: "flex" }}>
              <SettingsCard
                title="Navyfragen Feed"
                description="Browse anonymous questions and answers posted by everyone on Navyfragen worldwide. This feed may contain content intended for adults. View at your own discretion."
                isDark={isDark}
              >
                <Button
                  component="a"
                  href="https://bsky.app/profile/navyfragen.app/feed/navyfragen"
                  target="_blank"
                  rel="noopener noreferrer"
                  fullWidth
                  variant="outline"
                >
                  Open Feed on Bluesky
                </Button>
              </SettingsCard>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6, lg: 4 }} style={{ display: "flex" }}>
              <SettingsCard
                title="Daily Notifications"
                description="Follow the Navyfragen notification bot on Bluesky to receive a daily alert when you have new messages in your inbox."
                isDark={isDark}
              >
                {sessionLoading || botFollowLoading ? (
                  <Skeleton height={36} radius="sm" />
                ) : botFollowData?.following ? (
                  <Button
                    component="a"
                    href="https://bsky.app/profile/did:plc:3d4awubjiftylwrhhyp5vl7i"
                    target="_blank"
                    rel="noopener noreferrer"
                    fullWidth
                    variant="gradient"
                    gradient={{ from: "royal", to: "purple", deg: 135 }}
                  >
                    Notifications enabled ✓
                  </Button>
                ) : (
                  <Button
                    component="a"
                    href="https://bsky.app/profile/did:plc:3d4awubjiftylwrhhyp5vl7i"
                    target="_blank"
                    rel="noopener noreferrer"
                    fullWidth
                    variant="outline"
                  >
                    Follow Notification Bot
                  </Button>
                )}
              </SettingsCard>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6, lg: 4 }} style={{ display: "flex" }}>
              <SettingsCard
                title="Delete my Data"
                description="Permanently remove all your data from the Navyfragen servers, and Bluesky PDS. This also disables your inbox so you will no longer receive messages. You can always log back in to reregister automatically."
                isDark={isDark}
              >
                <Button
                  fullWidth
                  radius="xl"
                  fw={700}
                  color="red"
                  variant="filled"
                  onClick={() => setDeleteModalOpened(true)}
                >
                  Delete my Data
                </Button>
              </SettingsCard>
            </Grid.Col>
          </Grid>

          <ConfirmationModal
            opened={deleteModalOpened}
            onClose={() => setDeleteModalOpened(false)}
            onConfirm={async () => {
              try {
                document.body.style.pointerEvents = "none";
                document.body.style.opacity = "0.5";
                await apiClient.delete("/delete-account");
                window.location.href = "/";
              } catch {
                document.body.style.pointerEvents = "";
                document.body.style.opacity = "";
              }
              setDeleteModalOpened(false);
            }}
            title="Delete Account"
            message="Are you sure you want to delete your account and all data? This cannot be undone."
            confirmLabel="Delete"
          />
        </>
      )}
    </>
  );
}

interface StatItemProps {
  value: string | number;
  label: string;
  size: number;
  truncate?: boolean;
}

function StatItem({ value, label, size, truncate }: StatItemProps) {
  return (
    <Stack gap={2} style={truncate ? { minWidth: 0 } : undefined}>
      <Text
        fw={800}
        variant="gradient"
        gradient={{ from: "royal", to: "purple", deg: 135 }}
        truncate={truncate}
        style={{ fontSize: size, letterSpacing: "-0.02em", lineHeight: 1.1 }}
      >
        {value}
      </Text>
      <Text
        ff="monospace"
        size="xs"
        c="dimmed"
        tt="uppercase"
        style={{ letterSpacing: "0.08em" }}
      >
        {label}
      </Text>
    </Stack>
  );
}
