import { Modal, Button, Text, Group } from "@mantine/core";

interface ConfirmationModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean; // Added loading prop
}

export function ConfirmationModal({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false, // Added loading prop with default value
}: ConfirmationModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Text mb="md">{message}</Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose} disabled={loading}>
          {" "}
          {/* Disable cancel if loading */}
          {cancelLabel}
        </Button>
        <Button
          color="blue"
          onClick={() => {
            onConfirm();
            // onClose(); // Removed: Let the caller handle closing after onConfirm completes
          }}
          loading={loading} // Pass loading to Mantine Button
        >
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  );
}
