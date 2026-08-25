import { Modal, Button, Text, Group } from "@mantine/core";

import { useTranslations } from "../lib/i18n";

interface ConfirmationModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Colours the confirm button as a destructive action rather than a primary one. */
  destructive?: boolean;
  loading?: boolean;
}

export function ConfirmationModal({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
}: ConfirmationModalProps) {
  const messages = useTranslations();

  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Text mb="md">{message}</Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose} disabled={loading}>
          {cancelLabel ?? messages.common.cancel}
        </Button>
        <Button color={destructive ? "crimson" : "royal"} onClick={onConfirm} loading={loading}>
          {confirmLabel ?? messages.common.confirm}
        </Button>
      </Group>
    </Modal>
  );
}
