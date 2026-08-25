import { Alert, Button, Grid, Select, Skeleton, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconDownload, IconExternalLink, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { useHaptic } from "use-haptic";

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
import { PushNotificationsCard } from "../components/PushNotificationsCard";
import { AccountOverview, type Stat } from "../components/settings/AccountOverview";
import { SettingsCard } from "../components/SettingsCard";
import { SettingsToggle } from "../components/SettingsToggle";
import { APP_NAME } from "../lib/brand";
import { uiLocaleOptions, useTranslations } from "../lib/i18n";
import { resolveApiErrorMessage } from "../lib/i18n/apiErrors";

const NOTIFICATION_BOT = "https://bsky.app/profile/did:plc:3d4awubjiftylwrhhyp5vl7i";
const CARD_SPAN = { base: 12, md: 6, lg: 4 };

export default function Settings() {
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const messages = useTranslations();

  const { data: session, isLoading: sessionLoading } = useSession();
  const {
    data: userSettings,
    isLoading: settingsLoading,
    error: settingsError,
    refetch: refetchSettings,
  } = useUserSettings();
  const updateSettings = useUpdateUserSettings({
    onError: (error: ApiError) => {
      notifications.show({
        title: "Update Failed",
        message: resolveApiErrorMessage(error, messages),
        color: "red",
      });
    },
  });
  const { data: userStats, isLoading: statsLoading } = useUserStats();
  const { data: pdsInfo, isLoading: pdsLoading } = usePdsInfo();
  const { installPrompt, setInstallPrompt } = useInstallPrompt();
  const { data: botFollowData, isLoading: botFollowLoading } = useBotFollow(
    Boolean(session?.isLoggedIn)
  );
  const isFollowingBot = Boolean(botFollowData?.following);

  const { triggerHaptic } = useHaptic(1);
  const busy = updateSettings.isPending;

  const handleInstallClick = async () => {
    triggerHaptic();
    /* istanbul ignore if */
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

  const pdsSyncControl = settingsLoading ? (
    <Skeleton height={22} width={38} radius="xl" />
  ) : settingsError ? null : (
    <SettingsToggle
      label="PDS Sync"
      checked={Boolean(userSettings?.pdsSyncEnabled)}
      saving={updateSettings.isPending}
      onChange={(checked) => {
        updateSettings.mutate({
          pdsSyncEnabled: checked,
          imageTheme: userSettings?.imageTheme || "default",
        });
      }}
    />
  );

  const stats: Stat[] = [
    { value: userStats?.messageCount ?? "—", label: "Messages in inbox", size: "large" },
    { value: pdsInfo?.recordCount ?? "—", label: "Answers on PDS", size: "large" },
    { value: formatMemberSince(userStats?.memberSince), label: "Active since", size: "medium" },
    {
      value: pdsInfo?.pdsUrl ? pdsInfo.pdsUrl.replace(/^https?:\/\//, "") : "—",
      label: "PDS",
      size: "small",
      truncate: true,
    },
  ];

  if (!session?.isLoggedIn && !sessionLoading) {
    return (
      <Alert title="Error" color="red">
        You cannot access this page without logging in.
      </Alert>
    );
  }

  return (
    <>
      <Title order={1} mb="xl" style={{ letterSpacing: "-0.03em" }}>
        Settings
      </Title>

      <Grid style={{ gap: "var(--mantine-spacing-md)" }}>
        <Grid.Col span={12}>
          <AccountOverview loading={statsLoading || pdsLoading} stats={stats} />
        </Grid.Col>

        <Grid.Col span={CARD_SPAN} style={{ display: "flex" }}>
          <SettingsCard
            title="Install Application"
            description="Install the app for faster access on any device: phone, tablet or laptop. It runs in the same browser, and you can uninstall it any time."
          >
            <Button
              onClick={handleInstallClick}
              fullWidth
              disabled={!installPrompt}
              leftSection={<IconDownload size={16} />}
            >
              Install {APP_NAME}
            </Button>
          </SettingsCard>
        </Grid.Col>

        <Grid.Col span={CARD_SPAN} style={{ display: "flex" }}>
          <SettingsCard
            title="PDS Sync"
            description={`${APP_NAME} syncs your anonymous messages to your Bluesky PDS (Personal Data Server). Turn this off to keep them on ${APP_NAME}'s servers only. Posting to Bluesky is unaffected.`}
            control={pdsSyncControl}
          >
            {settingsError ? settingsLoadError : null}
          </SettingsCard>
        </Grid.Col>

        <Grid.Col span={CARD_SPAN} style={{ display: "flex" }}>
          <SettingsCard
            title="App language"
            description="The language you read the app in — nav, buttons, and toasts. Separate from Message language on Customise, which is what visitors and your audience see."
          >
            {settingsLoading ? (
              <Skeleton height={36} radius="sm" />
            ) : settingsError ? (
              settingsLoadError
            ) : (
              <Select
                data={uiLocaleOptions}
                value={
                  uiLocaleOptions.some((l) => l.value === userSettings?.uiLocale)
                    ? userSettings!.uiLocale!
                    : "en"
                }
                // Only "en" exists (#401) and it's always the selected option, so
                // Mantine never fires onChange through the rendered UI — see
                // docs/testing-notes.md.
                onChange={
                  /* istanbul ignore next */
                  (value) => {
                    updateSettings.mutate({ uiLocale: value || null });
                  }
                }
                disabled={busy}
                allowDeselect={false}
                aria-label="App language"
              />
            )}
          </SettingsCard>
        </Grid.Col>

        <Grid.Col span={CARD_SPAN} style={{ display: "flex" }}>
          <PushNotificationsCard />
        </Grid.Col>

        <Grid.Col span={CARD_SPAN} style={{ display: "flex" }}>
          <SettingsCard
            title={`${APP_NAME} Feed`}
            description={`Browse anonymous questions and answers posted by everyone on ${APP_NAME} worldwide. This feed may contain content intended for adults. View at your own discretion.`}
          >
            <Button
              component="a"
              href="https://bsky.app/profile/navyfragen.app/feed/navyfragen"
              target="_blank"
              rel="noopener noreferrer"
              fullWidth
              variant="outline"
              rightSection={<IconExternalLink size={14} />}
            >
              Open Feed on Bluesky
            </Button>
          </SettingsCard>
        </Grid.Col>

        <Grid.Col span={CARD_SPAN} style={{ display: "flex" }}>
          <SettingsCard
            title="Daily Notifications"
            description={`Follow the ${APP_NAME} notification bot on Bluesky to receive a daily alert when you have new messages in your inbox.`}
          >
            {sessionLoading || botFollowLoading ? (
              <Skeleton height={36} radius="sm" />
            ) : (
              <Button
                component="a"
                href={NOTIFICATION_BOT}
                target="_blank"
                rel="noopener noreferrer"
                fullWidth
                variant="outline"
                rightSection={<IconExternalLink size={14} />}
              >
                {isFollowingBot ? "View bot on Bluesky" : "Follow the bot on Bluesky"}
              </Button>
            )}
          </SettingsCard>
        </Grid.Col>

        <Grid.Col span={CARD_SPAN} style={{ display: "flex" }}>
          <SettingsCard
            title="Delete my Data"
            description={`Permanently remove all your data from the ${APP_NAME} servers, and Bluesky PDS. This also disables your inbox so you will no longer receive messages. You can always log back in to reregister automatically.`}
          >
            <Button
              fullWidth
              radius="md"
              fw={600}
              color="crimson"
              variant="filled"
              leftSection={<IconTrash size={16} />}
              onClick={() => {
                triggerHaptic();
                setDeleteModalOpened(true);
              }}
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
        destructive
      />
    </>
  );
}

function formatMemberSince(memberSince: string | null | undefined): string {
  if (!memberSince) return "—";
  return new Date(memberSince).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
