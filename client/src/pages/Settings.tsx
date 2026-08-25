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
        title: messages.settingsPage.updateFailedTitle,
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
    <Alert color="red" title={messages.common.settingsLoadErrorTitle} withCloseButton={false}>
      <Button size="xs" onClick={() => refetchSettings()} variant="light" mt="xs">
        {messages.common.retry}
      </Button>
    </Alert>
  );

  const pdsSyncControl = settingsLoading ? (
    <Skeleton height={22} width={38} radius="xl" />
  ) : settingsError ? null : (
    <SettingsToggle
      label={messages.settingsPage.pdsSync}
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
    {
      value: userStats?.messageCount ?? "—",
      label: messages.settingsPage.messagesInInbox,
      size: "large",
    },
    {
      value: pdsInfo?.recordCount ?? "—",
      label: messages.settingsPage.answersOnPds,
      size: "large",
    },
    {
      value: formatMemberSince(userStats?.memberSince),
      label: messages.settingsPage.activeSince,
      size: "medium",
    },
    {
      value: pdsInfo?.pdsUrl ? pdsInfo.pdsUrl.replace(/^https?:\/\//, "") : "—",
      label: messages.settingsPage.pdsLabel,
      size: "small",
      truncate: true,
    },
  ];

  if (!session?.isLoggedIn && !sessionLoading) {
    return (
      <Alert title={messages.common.errorTitle} color="red">
        {messages.common.accessDeniedMessage}
      </Alert>
    );
  }

  return (
    <>
      <Title order={1} mb="xl" style={{ letterSpacing: "-0.03em" }}>
        {messages.settingsPage.heading}
      </Title>

      <Grid style={{ gap: "var(--mantine-spacing-md)" }}>
        <Grid.Col span={12}>
          <AccountOverview loading={statsLoading || pdsLoading} stats={stats} />
        </Grid.Col>

        <Grid.Col span={CARD_SPAN} style={{ display: "flex" }}>
          <SettingsCard
            title={messages.settingsPage.installApplication}
            description={messages.settingsPage.installApplicationDescription}
          >
            <Button
              onClick={handleInstallClick}
              fullWidth
              disabled={!installPrompt}
              leftSection={<IconDownload size={16} />}
            >
              {messages.settingsPage.install}
              {APP_NAME}
            </Button>
          </SettingsCard>
        </Grid.Col>

        <Grid.Col span={CARD_SPAN} style={{ display: "flex" }}>
          <SettingsCard
            title={messages.settingsPage.pdsSync}
            description={messages.settingsPage.pdsSyncDescription(APP_NAME)}
            control={pdsSyncControl}
          >
            {settingsError ? settingsLoadError : null}
          </SettingsCard>
        </Grid.Col>

        <Grid.Col span={CARD_SPAN} style={{ display: "flex" }}>
          <SettingsCard
            title={messages.settingsPage.appLanguage}
            description={messages.settingsPage.appLanguageDescription}
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
                aria-label={messages.settingsPage.appLanguage}
              />
            )}
          </SettingsCard>
        </Grid.Col>

        <Grid.Col span={CARD_SPAN} style={{ display: "flex" }}>
          <PushNotificationsCard />
        </Grid.Col>

        <Grid.Col span={CARD_SPAN} style={{ display: "flex" }}>
          <SettingsCard
            title={messages.settingsPage.feedTitle(APP_NAME)}
            description={messages.settingsPage.feedDescription(APP_NAME)}
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
              {messages.settingsPage.openFeedOnBluesky}
            </Button>
          </SettingsCard>
        </Grid.Col>

        <Grid.Col span={CARD_SPAN} style={{ display: "flex" }}>
          <SettingsCard
            title={messages.settingsPage.dailyNotifications}
            description={messages.settingsPage.dailyNotificationsDescription(APP_NAME)}
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
                {isFollowingBot
                  ? messages.settingsPage.viewBotOnBluesky
                  : messages.settingsPage.followTheBotOnBluesky}
              </Button>
            )}
          </SettingsCard>
        </Grid.Col>

        <Grid.Col span={CARD_SPAN} style={{ display: "flex" }}>
          <SettingsCard
            title={messages.settingsPage.deleteMyData}
            description={messages.settingsPage.deleteMyDataDescription(APP_NAME)}
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
              {messages.settingsPage.deleteMyData}
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
        title={messages.settingsPage.deleteAccountTitle}
        message={messages.settingsPage.deleteAccountMessage}
        confirmLabel={messages.common.delete}
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
