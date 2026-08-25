import { Button } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { useSyncExternalStore } from "react";
import { useHaptic } from "use-haptic";

import { useTranslations } from "../lib/i18n";
import { applyUpdate, isUpdateReady, subscribeToUpdate } from "../lib/swUpdate";

export function UpdateAvailableButton() {
  const updateReady = useSyncExternalStore(subscribeToUpdate, isUpdateReady, isUpdateReady);
  const { triggerHaptic } = useHaptic(1);
  const messages = useTranslations();

  if (!updateReady) return null;

  return (
    <Button
      onClick={() => {
        triggerHaptic();
        applyUpdate();
      }}
      size="xs"
      radius="xl"
      variant="light"
      color="royal"
      leftSection={<IconRefresh size={14} />}
      aria-label={messages.updateAvailableButton.ariaLabel}
    >
      {messages.updateAvailableButton.buttonLabel}
    </Button>
  );
}
