import { Skeleton } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";

import {
  getPushPermission,
  useDisablePushNotifications,
  useEnablePushNotifications,
  usePushAvailable,
  type PushPermission,
} from "../api/notificationService";
import { useTranslations } from "../lib/i18n";
import { resolveApiErrorMessage } from "../lib/i18n/apiErrors";

import { SettingsCard } from "./SettingsCard";
import { SettingsToggle } from "./SettingsToggle";

const SUBSCRIBED_FLAG = "nf-push-subscribed";

const DESCRIPTION =
  "Get a push notification when a message arrives. Accept your browser's prompt to turn it on; clearing site data turns it off. Covers every account signed in on this device.";

function blockedReason(
  isServerPushAvailable: boolean | undefined,
  permission: PushPermission
): string | undefined {
  if (isServerPushAvailable === false) return "Push is not configured on this server.";
  if (permission === "unsupported") return "This browser cannot receive push notifications.";
  if (permission === "denied") {
    return "Blocked in your browser settings. Re-allow notifications for this site to turn it on.";
  }
  return undefined;
}

/**
 * Owns its whole card, because the reason push is unavailable and the switch
 * that reason disables are rendered in two different card slots.
 */
export function PushNotificationsCard() {
  const messages = useTranslations();
  const { data: isServerPushAvailable, isLoading: isCheckingAvailability } = usePushAvailable();
  const enablePush = useEnablePushNotifications();
  const disablePush = useDisablePushNotifications();

  const permission: PushPermission = getPushPermission();

  const [locallySubscribed, setLocallySubscribed] = useState(
    typeof localStorage !== "undefined" && localStorage.getItem(SUBSCRIBED_FLAG) === "1"
  );
  // The stored flag is not enough — the browser must still hold permission.
  const isSubscribed = permission === "granted" && locallySubscribed;

  const isBusy = enablePush.isPending || disablePush.isPending;
  const unavailable = blockedReason(isServerPushAvailable, permission);

  const togglePush = async () => {
    try {
      if (isSubscribed) {
        await disablePush.mutateAsync();
        localStorage.removeItem(SUBSCRIBED_FLAG);
        setLocallySubscribed(false);
      } else {
        await enablePush.mutateAsync();
        localStorage.setItem(SUBSCRIBED_FLAG, "1");
        setLocallySubscribed(true);
      }
    } catch (err) {
      notifications.show({
        title: "Push notifications",
        message: resolveApiErrorMessage(err as { error?: string; message?: string }, messages),
        color: "red",
      });
    }
  };

  return (
    <SettingsCard
      title="Push Notifications"
      description={DESCRIPTION}
      note={unavailable}
      control={
        isCheckingAvailability ? (
          <Skeleton height={22} width={38} radius="xl" />
        ) : (
          <SettingsToggle
            label="Push Notifications"
            checked={isSubscribed}
            onChange={togglePush}
            disabled={unavailable !== undefined}
            saving={isBusy}
          />
        )
      }
    />
  );
}
