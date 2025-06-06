import { useState, useEffect } from "react";
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
} from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { apiClient, ApiError } from "../api/apiClient";
import { useSession } from "../api/authService";
import { useUserSettings, useUpdateUserSettings } from "../api/settingsService";

export default function Settings() {
  const [installPrompt, setInstallPrompt] = useState<any | null>(null);
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
      console.log("Settings updated successfully.");
      // No UI success notification will be shown
    },
    onError: (error: ApiError) => {
      console.error("Failed to update settings:", error);
      setUpdateError(
        error.error || "Failed to update settings. Please try again."
      );
      setTimeout(() => setUpdateError(null), 5000);
    },
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) {
      return;
    }
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null);
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
            <Grid.Col span={{ base: 12, md: 6, lg: 4 }}>
              <Paper shadow="sm" p="lg" radius="md" withBorder>
                <Title order={3}>Install Application</Title>
                <Text mt="sm" c="dimmed">
                  Install the app for faster access. Works with almost any
                  device you own, including tablets and laptops. Uninstall the
                  app anytime.
                </Text>
                <Divider my="md" />
                <Button onClick={handleInstallClick} mt="md" fullWidth>
                  Install Navyfragen
                </Button>
              </Paper>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6, lg: 4 }}>
              <Paper shadow="sm" p="lg" radius="md" withBorder>
                <Title order={3}>PDS Sync</Title>
                <Text mt="sm" c="dimmed">
                  By default, Navyfragen syncs your anonymous messages with your
                  Bluesky PDS (Personal Data Server). Disable this if you wish
                  to keep your data on Navyfragen's servers.
                </Text>{" "}
                <Divider my="md" />{" "}
                {settingsLoading ? (
                  <Loader size="sm" />
                ) : settingsError ? (
                  <div>
                    <Text c="red" size="sm" mb="xs">
                      Failed to load settings
                    </Text>
                    <Button
                      size="xs"
                      onClick={() => refetchSettings()}
                      variant="light"
                    >
                      Retry
                    </Button>
                  </div>
                ) : (
                  <div style={{ opacity: updateSettings.isPending ? 0.6 : 1 }}>
                    <Switch
                      label="Enable PDS Sync"
                      checked={Boolean(userSettings?.pdsSyncEnabled)} // Ensures 0 is false, 1 is true
                      onChange={(event) => {
                        updateSettings.mutate({
                          pdsSyncEnabled: event.currentTarget.checked,
                        });
                      }}
                      disabled={updateSettings.isPending}
                    />
                    {updateSettings.isPending && <Loader size="xs" ml="sm" />}
                  </div>
                )}
              </Paper>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6, lg: 4 }}>
              <Paper shadow="sm" p="lg" radius="md" withBorder>
                <Title order={3}>Delete my Data</Title>
                <Text mt="sm" c="dimmed">
                  Permanently remove all your data from the Navyfragen servers,
                  and Bluesky PDS. This also disables your inbox. You can always
                  log back in to reregister automatically.
                </Text>
                <Divider my="md" />
                <Button
                  color="red"
                  fullWidth
                  onClick={() => setDeleteModalOpened(true)}
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
