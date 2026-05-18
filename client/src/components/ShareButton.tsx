import { Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconShare } from "@tabler/icons-react";

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
  const handleClick = async () => {
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
          color: "green",
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
    <Button onClick={handleClick}>
      <IconShare />
    </Button>
  );
};

export default ShareButton;
