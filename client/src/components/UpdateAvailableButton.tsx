import { Button } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { useState, useSyncExternalStore } from "react";
import { useHaptic } from "use-haptic";

import { useTranslations } from "../lib/i18n";
import { applyUpdate, isUpdateReady, subscribeToUpdate } from "../lib/swUpdate";

export function UpdateAvailableButton() {
  const updateReady = useSyncExternalStore(subscribeToUpdate, isUpdateReady, isUpdateReady);
  // Applying swaps the waiting worker in and reloads the page, which takes long
  // enough to look like nothing happened. The state only has to outlive the
  // click: the reload tears the component down.
  const [applying, setApplying] = useState(false);
  const { triggerHaptic } = useHaptic(1);
  const messages = useTranslations();

  if (!updateReady) return null;

  return (
    <Button
      onClick={() => {
        triggerHaptic();
        setApplying(true);
        applyUpdate();
      }}
      loading={applying}
      disabled={applying}
      size="xs"
      radius="xl"
      variant="light"
      color="royal"
      leftSection={<IconRefresh size={14} />}
      aria-label={
        applying
          ? messages.updateAvailableButton.applyingAriaLabel
          : messages.updateAvailableButton.ariaLabel
      }
    >
      {applying
        ? messages.updateAvailableButton.applyingLabel
        : messages.updateAvailableButton.buttonLabel}
    </Button>
  );
}
