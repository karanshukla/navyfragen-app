import { Modal, Button, Text, Group } from "@mantine/core";

interface ConfirmationModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
}

export function ConfirmationModal({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
}: ConfirmationModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Text mb="md">{message}</Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          color="blue"
          onClick={() => {
            onConfirm();
          }}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  );
}
