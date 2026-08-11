import { Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconShare } from "@tabler/icons-react";
import React from "react";
import { useHaptic } from "use-haptic";

import { onGrad, onGradBorder, onGradFill } from "../styles/tokens";

/**
 * Chrome for a button that sits directly on a brand gradient — a translucent
 * wash of the gradient's own foreground rather than a surface colour, which
 * would fight it. Exported because the inbox hero pairs Copy with this Share.
 */
export const onGradientButton = {
  background: onGradFill,
  border: `1px solid ${onGradBorder}`,
  "--button-color": onGrad,
} as React.CSSProperties;

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
      style={onGradientButton}
    >
      Share
    </Button>
  );
};

export default ShareButton;
