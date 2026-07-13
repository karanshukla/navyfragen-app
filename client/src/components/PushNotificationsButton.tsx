import { Loader, Switch } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";

import {
  getPushPermission,
  useDisablePushNotifications,
  useEnablePushNotifications,
  usePushAvailable,
  type PushPermission,
} from "../api/notificationService";

const SUBSCRIBED_FLAG = "nf-push-subscribed";

export function PushNotificationsButton() {
  const { data: isServerPushAvailable, isLoading: isCheckingAvailability } = usePushAvailable();
  const enablePush = useEnablePushNotifications();
  const disablePush = useDisablePushNotifications();

  const permission: PushPermission = getPushPermission();
  const isBrowserSupported = permission !== "unsupported";

  const [locallySubscribed, setLocallySubscribed] = useState(
    typeof localStorage !== "undefined" && localStorage.getItem(SUBSCRIBED_FLAG) === "1"
  );
  // Effective state: the flag must be set AND the browser must still hold permission.
  const isSubscribed = permission === "granted" && locallySubscribed;

  const isBusy = enablePush.isPending || disablePush.isPending;
  const isUnavailable =
    isServerPushAvailable === false || !isBrowserSupported || permission === "denied";

  if (isCheckingAvailability) return <Loader size="sm" />;

  if (isUnavailable) {
    // A disabled switch reads as "off, and you can't turn it on here" more
    // clearly than the old inert button, and matches the PDS Sync control's
    // affordance on the neighbouring card.
    return <Switch size="lg" label="Push Notifications Unavailable" checked={false} disabled />;
  }

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
        message: (err as { error?: string })?.error || "Something went wrong. Please try again.",
        color: "red",
      });
    }
  };

  return (
    <Switch
      size="lg"
      label={isSubscribed ? "Push Notifications Enabled" : "Enable Push Notifications"}
      checked={isSubscribed}
      disabled={isBusy}
      onChange={togglePush}
    />
  );
}
