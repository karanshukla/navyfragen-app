import { Switch, Text, Stack, Loader } from "@mantine/core";

import {
  useDisablePushNotifications,
  useEnablePushNotifications,
  usePushAvailable,
  getPushPermission,
  type PushPermission,
} from "../api/notificationService";

/**
 * Self-contained push-notifications toggle for the Settings page.
 *
 * State model (deliberately not persisted server-side — see CLAUDE.md on the
 * NF/Bluesky separation. The *subscription* lives server-side in
 * push_subscription, but the on/off *preference* is implied by whether a
 * subscription exists for this browser):
 *
 *   - Server push unavailable (no VAPID)        → disabled, "Unavailable"
 *   - Browser blocked notification permission   → disabled, "Blocked in browser"
 *   - Browser supports, permission "default"    → off, toggle asks permission
 *   - Permission granted + subscribed            → on
 *
 * The toggle is optimistic about its own checked state: it reflects the last
 * known permission/subscription outcome, and re-derives on mount.
 */
export function PushNotificationsControl() {
  const { data: available, isLoading: availabilityLoading } = usePushAvailable();
  const enableMutation = useEnablePushNotifications();
  const disableMutation = useDisablePushNotifications();

  const permission: PushPermission = getPushPermission();
  const isSupported = permission !== "unsupported";

  // Determining "subscribed" requires an async SW check; we approximate from
  // permission + a localStorage flag set on successful subscribe. This keeps
  // the component synchronous and avoids a blocking SW probe on every render.
  // The authoritative source is the server's push_subscription table.
  const subscribedFlag =
    typeof localStorage !== "undefined" && localStorage.getItem("nf-push-subscribed") === "1";
  const isChecked = permission === "granted" && subscribedFlag;

  const busy = enableMutation.isPending || disableMutation.isPending;

  if (availabilityLoading) {
    return <Loader size="sm" />;
  }

  // Server doesn't have VAPID configured
  if (available === false) {
    return (
      <Stack gap={4}>
        <Switch size="lg" label="Enable Push Notifications" disabled />
        <Text size="xs" c="dimmed">
          Push notifications are not yet available on this server.
        </Text>
      </Stack>
    );
  }

  // Browser doesn't support the Push API at all
  if (!isSupported) {
    return (
      <Stack gap={4}>
        <Switch size="lg" label="Enable Push Notifications" disabled />
        <Text size="xs" c="dimmed">
          Push notifications are not supported by this browser.
        </Text>
      </Stack>
    );
  }

  // User previously denied notification permission at the browser level
  if (permission === "denied") {
    return (
      <Stack gap={4}>
        <Switch size="lg" label="Enable Push Notifications" disabled />
        <Text size="xs" c="dimmed">
          Notifications are blocked in your browser settings. Re-enable them in your site
          permissions to use push.
        </Text>
      </Stack>
    );
  }

  const handleToggle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const wantsOn = event.currentTarget.checked;
    try {
      if (wantsOn) {
        await enableMutation.mutateAsync();
        localStorage.setItem("nf-push-subscribed", "1");
      } else {
        await disableMutation.mutateAsync();
        localStorage.removeItem("nf-push-subscribed");
      }
    } catch {
      // Error toast is handled by the caller via mutation onError; nothing here.
    }
  };

  return (
    <Switch
      size="lg"
      label="Enable Push Notifications"
      checked={isChecked}
      onChange={handleToggle}
      disabled={busy}
      styles={{
        label: { opacity: 1, color: "inherit" },
        track: { opacity: busy ? 0.7 : 1 },
        thumb: { opacity: busy ? 0.7 : 1 },
      }}
    />
  );
}
