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
  Notification,
  Select,
  Stack,
  useComputedColorScheme,
} from "@mantine/core";
import { IconX } from "@tabler/icons-react";
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
import { themes } from "../lib/themes";

export default function Settings() {
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });
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
      setUpdateError(
        error.error || "Failed to update settings. Please try again.",
      );
      setTimeout(() => setUpdateError(null), 5000);
    },
  });
  const { data: userStats, isLoading: statsLoading } = useUserStats();
  const { data: pdsInfo, isLoading: pdsLoading } = usePdsInfo();
  const { installPrompt, setInstallPrompt } = useInstallPrompt();
  const { data: botFollowData, isLoading: botFollowLoading } = useBotFollow(
    Boolean(session?.isLoggedIn),
  );

  const cardStyle: React.CSSProperties = {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    borderRadius: 14,
    padding: 20,
    background:
      computedColorScheme === "dark" ? "rgba(255,255,255,0.06)" : "#F2EBFF",
  };

  const cardTitleStyle: React.CSSProperties = {
    fontFamily: "Inter, sans-serif",
    fontWeight: 700,
    fontSize: 18,
    marginBottom: 10,
  };

  const cardBodyStyle: React.CSSProperties = {
    fontSize: 13,
    lineHeight: 1.5,
    flexGrow: 1,
    marginBottom: 16,
  };

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
  };

  return (
    <>
      {!session?.isLoggedIn && !sessionLoading ? (
        <Alert title="Error" color="red">
          You cannot access this page without logging in.
        </Alert>
      ) : (
        <>
          {updateError && (
            <Notification
              icon={<IconX size="1.1rem" />}
              color="red"
              title="Update Failed"
              mb="md"
              onClose={() => setUpdateError(null)}
            >
              {updateError}
            </Notification>
          )}
          <Title
            order={1}
            mb="xl"
            style={{
              fontFamily: "Inter",
              fontWeight: 800,
              fontSize: 32,
              letterSpacing: "-0.03em",
            }}
          >
            Settings
          </Title>
          <Grid gutter="md">
            {/* Account Overview */}
            <Grid.Col span={12}>
              <Paper
                withBorder
                style={{
                  borderRadius: 14,
                  padding: 24,
                  background:
                    computedColorScheme === "dark"
                      ? "rgba(255,255,255,0.06)"
                      : "#F2EBFF",
                }}
              >
                <Text fw={700} style={{ fontSize: 18, marginBottom: 18 }}>
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
                  <SimpleGrid
                    cols={{ base: 2, sm: 4 }}
                    spacing="xl"
                    style={{ alignItems: "flex-end" }}
                  >
                    <Stack gap={2}>
                      <Text
                        fw={800}
                        variant="gradient"
                        gradient={{ from: "royal", to: "purple", deg: 135 }}
                        style={{
                          fontSize: 32,
                          letterSpacing: "-0.02em",
                          lineHeight: 1.1,
                        }}
                      >
                        {userStats?.messageCount ?? "—"}
                      </Text>
                      <Text
                        ff="monospace"
                        size="xs"
                        c="dimmed"
                        tt="uppercase"
                        style={{ letterSpacing: "0.08em" }}
                      >
                        Messages in inbox
                      </Text>
                    </Stack>
                    <Stack gap={2}>
                      <Text
                        fw={800}
                        variant="gradient"
                        gradient={{ from: "royal", to: "purple", deg: 135 }}
                        style={{
                          fontSize: 32,
                          letterSpacing: "-0.02em",
                          lineHeight: 1.1,
                        }}
                      >
                        {pdsInfo?.recordCount ?? "—"}
                      </Text>
                      <Text
                        ff="monospace"
                        size="xs"
                        c="dimmed"
                        tt="uppercase"
                        style={{ letterSpacing: "0.08em" }}
                      >
                        Answers on PDS
                      </Text>
                    </Stack>
                    <Stack gap={2}>
                      <Text
                        fw={800}
                        variant="gradient"
                        gradient={{ from: "royal", to: "purple", deg: 135 }}
                        style={{
                          fontSize: 22,
                          letterSpacing: "-0.02em",
                          lineHeight: 1.1,
                        }}
                      >
                        {userStats?.memberSince
                          ? new Date(userStats.memberSince).toLocaleDateString(
                              undefined,
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              },
                            )
                          : "—"}
                      </Text>
                      <Text
                        ff="monospace"
                        size="xs"
                        c="dimmed"
                        tt="uppercase"
                        style={{ letterSpacing: "0.08em" }}
                      >
                        Active since
                      </Text>
                    </Stack>
                    <Stack gap={2} style={{ minWidth: 0 }}>
                      <Text
                        fw={800}
                        variant="gradient"
                        gradient={{ from: "royal", to: "purple", deg: 135 }}
                        truncate
                        style={{
                          fontSize: 13,
                          letterSpacing: "-0.01em",
                          lineHeight: 1.1,
                        }}
                      >
                        {pdsInfo?.pdsUrl
                          ? pdsInfo.pdsUrl.replace(/^https?:\/\//, "")
                          : "—"}
                      </Text>
                      <Text
                        ff="monospace"
                        size="xs"
                        c="dimmed"
                        tt="uppercase"
                        style={{ letterSpacing: "0.08em" }}
                      >
                        PDS
                      </Text>
                    </Stack>
                  </SimpleGrid>
                )}
              </Paper>
            </Grid.Col>

            {/* Install Application */}
            <Grid.Col
              span={{ base: 12, md: 6, lg: 4 }}
              style={{ display: "flex" }}
            >
              <Paper withBorder style={cardStyle}>
                <Text style={cardTitleStyle}>Install Application</Text>
                <Text c="dimmed" style={cardBodyStyle}>
                  Install the app for faster access. Works with almost any
                  device you own, including tablets and laptops. Uninstall the
                  app anytime. On iOS or Android, it will be added to your home
                  screen and run with the same browser.
                </Text>
                <Button
                  onClick={handleInstallClick}
                  fullWidth
                  disabled={!installPrompt}
                  title={
                    !installPrompt ? "Refresh the page to enable install" : ""
                  }
                  variant="gradient"
                  gradient={{ from: "royal", to: "purple", deg: 135 }}
                >
                  Install Navyfragen
                </Button>
              </Paper>
            </Grid.Col>

            {/* PDS Sync */}
            <Grid.Col
              span={{ base: 12, md: 6, lg: 4 }}
              style={{ display: "flex" }}
            >
              <Paper withBorder style={cardStyle}>
                <Text style={cardTitleStyle}>PDS Sync</Text>
                <Text c="dimmed" style={cardBodyStyle}>
                  By default, Navyfragen syncs your anonymous messages with your
                  Bluesky PDS (Personal Data Server). Disable this if you wish
                  to keep your data on Navyfragen&apos;s servers. Will not change
                  your ability to post to Bluesky directly.
                </Text>
                {settingsLoading ? (
                  <Loader size="sm" />
                ) : settingsError ? (
                  <Alert
                    color="red"
                    title="Failed to load settings"
                    withCloseButton={false}
                  >
                    <Button
                      size="xs"
                      onClick={() => refetchSettings()}
                      variant="light"
                      mt="xs"
                    >
                      Retry
                    </Button>
                  </Alert>
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
              </Paper>
            </Grid.Col>

            {/* Image Theme */}
            <Grid.Col
              span={{ base: 12, md: 6, lg: 4 }}
              style={{ display: "flex" }}
            >
              <Paper withBorder style={cardStyle}>
                <Text style={cardTitleStyle}>Image Theme</Text>
                <Text c="dimmed" style={cardBodyStyle}>
                  Select a theme for the generated question images. By default,
                  Navyfragen will use a blue gradient similar to the NGL
                  Application. Note that this setting is not retroactive, and
                  will only apply to future responses.
                </Text>
                {settingsLoading ? (
                  <Loader size="sm" />
                ) : settingsError ? (
                  <Alert
                    color="red"
                    title="Failed to load settings"
                    withCloseButton={false}
                  >
                    <Button
                      size="xs"
                      onClick={() => refetchSettings()}
                      variant="light"
                      mt="xs"
                    >
                      Retry
                    </Button>
                  </Alert>
                ) : (
                  <Select
                    data={Object.entries(themes).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                    value={userSettings?.imageTheme || "default"}
                    onChange={(value) => {
                      if (value) {
                        updateSettings.mutate({
                          imageTheme: value,
                          pdsSyncEnabled: Boolean(userSettings?.pdsSyncEnabled),
                        });
                      }
                    }}
                    disabled={updateSettings.isPending}
                  />
                )}
              </Paper>
            </Grid.Col>

            {/* Navyfragen Feed */}
            <Grid.Col
              span={{ base: 12, md: 6, lg: 4 }}
              style={{ display: "flex" }}
            >
              <Paper withBorder style={cardStyle}>
                <Text style={cardTitleStyle}>Navyfragen Feed</Text>
                <Text c="dimmed" style={cardBodyStyle}>
                  Browse anonymous questions and answers posted by everyone on
                  Navyfragen worldwide. This feed may contain content intended
                  for adults. View at your own discretion.
                </Text>
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
              </Paper>
            </Grid.Col>

            {/* Daily Notifications */}
            <Grid.Col
              span={{ base: 12, md: 6, lg: 4 }}
              style={{ display: "flex" }}
            >
              <Paper withBorder style={cardStyle}>
                <Text style={cardTitleStyle}>Daily Notifications</Text>
                <Text c="dimmed" style={cardBodyStyle}>
                  Follow the Navyfragen notification bot on Bluesky to receive a
                  daily alert when you have new messages in your inbox.
                </Text>
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
              </Paper>
            </Grid.Col>

            {/* Delete my Data */}
            <Grid.Col
              span={{ base: 12, md: 6, lg: 4 }}
              style={{ display: "flex" }}
            >
              <Paper withBorder style={cardStyle}>
                <Text style={cardTitleStyle}>Delete my Data</Text>
                <Text c="dimmed" style={cardBodyStyle}>
                  Permanently remove all your data from the Navyfragen servers,
                  and Bluesky PDS. This also disables your inbox so you will no
                  longer receive messages. You can always log back in to
                  reregister automatically.
                </Text>
                <Button
                  fullWidth
                  radius="xl"
                  fw={700}
                  onClick={() => setDeleteModalOpened(true)}
                  style={{ background: "#DC2626", color: "#fff" }}
                >
                  Delete my Data
                </Button>
              </Paper>
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
              } catch (e: any) {
                console.error("Failed to delete account", e);
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
