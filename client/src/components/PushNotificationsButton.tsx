import { Loader, Button } from "@mantine/core";
import { useState } from "react";

import {
  useDisablePushNotifications,
  useEnablePushNotifications,
  usePushAvailable,
  getPushPermission,
  type PushPermission,
} from "../api/notificationService";

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
  const [subscribedFlag, setSubscribedFlag] = useState(
    typeof localStorage !== "undefined" && localStorage.getItem("nf-push-subscribed") === "1"
  );
  const isChecked = permission === "granted" && subscribedFlag;

  const busy = enableMutation.isPending || disableMutation.isPending;

  if (availabilityLoading) {
    return <Loader size="sm" />;
  }

  if (available === false || !isSupported || permission === "denied") {
    return (
      <Button fullWidth disabled>
        Enable Push Notifications
      </Button>
    );
  }

  const handleClick = async () => {
    try {
      if (!isChecked) {
        await enableMutation.mutateAsync();
        localStorage.setItem("nf-push-subscribed", "1");
        setSubscribedFlag(true);
      } else {
        await disableMutation.mutateAsync();
        localStorage.removeItem("nf-push-subscribed");
        setSubscribedFlag(false);
      }
    } catch {
      // Error toast is handled by the caller via mutation onError; nothing here.
    }
  };

  if (isChecked) {
    return (
      <Button fullWidth disabled={busy} onClick={handleClick}>
        Push Notifications enabled
      </Button>
    );
  }

  return (
    <Button fullWidth variant="outline" disabled={busy} onClick={handleClick}>
      Enable Push Notifications
    </Button>
  );
}
