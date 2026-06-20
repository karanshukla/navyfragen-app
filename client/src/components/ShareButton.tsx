import { Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconShare } from "@tabler/icons-react";
import React from "react";
import { useHaptic } from "use-haptic";

interface ShareButtonProps {
  shareData: {
    title?: string;
    text?: string;
    url?: string;
    files?: File[];
  };
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

const ShareButton = ({ shareData, onSuccess, onError }: ShareButtonProps) => {
  const { triggerHaptic } = useHaptic(1);
  const handleClick = async () => {
    triggerHaptic();
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        if (onSuccess) onSuccess();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (onError) onError(error);
      }
    } else if (navigator.clipboard && shareData.url) {
      try {
        await navigator.clipboard.writeText(shareData.url);
        notifications.show({
          color: "royal",
          title: "Copied!",
          message: "Link copied to clipboard.",
        });
        if (onSuccess) onSuccess();
      } catch (error) {
        notifications.show({
          color: "red",
          title: "Copy failed",
          message: "Failed to copy link to clipboard.",
        });
        if (onError) onError(error);
      }
    } else {
      notifications.show({
        color: "yellow",
        title: "Sharing unavailable",
        message: "Sharing is not supported on this browser.",
      });
    }
  };

  return (
    <Button
      onClick={handleClick}
      size="sm"
      radius="xl"
      variant="transparent"
      leftSection={<IconShare size={14} />}
      style={
        {
          background: "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.2)",
          "--button-color": "var(--mantine-white)",
        } as React.CSSProperties
      }
    >
      Share
    </Button>
  );
};

export default ShareButton;
