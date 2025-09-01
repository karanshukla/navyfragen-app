import { useState } from "react";
import {
  Container,
  Title,
  Grid,
  Paper,
  Text,
  Button,
  Switch,
  Divider,
  Alert,
  Loader,
  Notification,
  Select,
} from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { apiClient, ApiError } from "../api/apiClient";
import { useSession } from "../api/authService";
import { useUserSettings, useUpdateUserSettings } from "../api/settingsService";
import { useInstallPrompt } from "../components/InstallPromptContext";
import { themes } from "../lib/themes";

export default function Settings() {
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const {
    data: session,
    isLoading: sessionLoading,
    error: sessionError,
  } = useSession();
  const {
    data: userSettings,
    isLoading: settingsLoading,
    error: settingsError,
    refetch: refetchSettings,
  } = useUserSettings();
  const updateSettings = useUpdateUserSettings({
    onSuccess: () => {
      // Add some UI if there are other settings aside from just PDS sync
    },
    onError: (error: ApiError) => {
      setUpdateError(
        error.error || "Failed to update settings. Please try again."
      );
      setTimeout(() => setUpdateError(null), 5000);
    },
  });
  const { installPrompt, setInstallPrompt } = useInstallPrompt();

  const handleInstallClick = async () => {
    if (!installPrompt) {
      return;
    }
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
    }
    // If outcome is "dismissed", keep the prompt so the user can try again
  };

  return (
    <Container my="md">
      {" "}
      {!session?.isLoggedIn && !sessionLoading ? (
        <Alert title="Error" color="red">
          You cannot access this page without logging in.{" "}
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
          <Grid gutter="md">
            <Grid.Col span={12}>
              <Title order={1}>Settings</Title>
            </Grid.Col>
            <Grid.Col
              span={{ base: 12, md: 6, lg: 4 }}
              style={{ display: "flex" }}
            >
              <Paper
                shadow="sm"
                p="lg"
                radius="md"
                withBorder
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ flexGrow: 1 }}>
                  <Title order={3}>Install Application</Title>
                  <Text mt="sm" c="dimmed">
                    Install the app for faster access. Works with almost any
                    device you own, including tablets and laptops. Uninstall the
                    app anytime. On iOS or Android, it will be added to your
                    home screen and run with the same browser.
                  </Text>
                  <Divider my="md" />
                </div>
                <Button
                  onClick={handleInstallClick}
                  mt="auto"
                  fullWidth
                  disabled={!installPrompt}
                  title={
                    !installPrompt ? "Refresh the page to enable install" : ""
                  }
                >
                  Install Navyfragen
                </Button>
              </Paper>
            </Grid.Col>
            <Grid.Col
              span={{ base: 12, md: 6, lg: 4 }}
              style={{ display: "flex" }}
            >
              <Paper
                shadow="sm"
                p="lg"
                radius="md"
                withBorder
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ flexGrow: 1 }}>
                  <Title order={3}>PDS Sync</Title>
                  <Text mt="sm" c="dimmed">
                    By default, Navyfragen syncs your anonymous messages with
                    your Bluesky PDS (Personal Data Server). Disable this if you
                    wish to keep your data on Navyfragen's servers. Will not
                    change your ability to post to Bluesky directly.
                  </Text>{" "}
                  <Divider my="md" />{" "}
                </div>
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
                  <div
                    style={{
                      marginTop: "auto",
                    }}
                  >
                    <Switch
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
                        label: {
                          opacity: 1,
                          color: "inherit",
                        },
                        track: {
                          opacity: updateSettings.isPending ? 0.7 : 1,
                        },
                        thumb: {
                          opacity: updateSettings.isPending ? 0.7 : 1,
                        },
                      }}
                    />
                  </div>
                )}
              </Paper>
            </Grid.Col>
            <Grid.Col
              span={{ base: 12, md: 6, lg: 4 }}
              style={{ display: "flex" }}
            >
              <Paper
                shadow="sm"
                p="lg"
                radius="md"
                withBorder
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ flexGrow: 1 }}>
                  <Title order={3}>Image Theme</Title>
                  <Text mt="sm" c="dimmed">
                    Select a theme for the generated question images. By
                    default, Navyfragen will use a blue gradient similar to the
                    NGL Application. Note that this setting is not retroactive,
                    and will only apply to future responses.
                  </Text>{" "}
                  <Divider my="md" />{" "}
                </div>
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
                  <div
                    style={{
                      marginTop: "auto",
                    }}
                  >
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
                            pdsSyncEnabled: Boolean(
                              userSettings?.pdsSyncEnabled
                            ), // Ensure pdsSyncEnabled is always sent
                          });
                        }
                      }}
                      disabled={updateSettings.isPending}
                    />
                  </div>
                )}
              </Paper>
            </Grid.Col>
            <Grid.Col
              span={{ base: 12, md: 6, lg: 4 }}
              style={{ display: "flex" }}
            >
              <Paper
                shadow="sm"
                p="lg"
                radius="md"
                withBorder
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ flexGrow: 1 }}>
                  <Title order={3}>Delete my Data</Title>
                  <Text mt="sm" c="dimmed">
                    Permanently remove all your data from the Navyfragen
                    servers, and Bluesky PDS. This also disables your inbox so
                    you will no longer receive messages. You can always log back
                    in to reregister automatically.
                  </Text>
                  <Divider my="md" />
                </div>
                <Button
                  color="red"
                  fullWidth
                  onClick={() => setDeleteModalOpened(true)}
                  mt="auto"
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
    </Container>
  );
}
