import { Button } from "@mantine/core";
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
    console.log("ShareButton clicked");
    console.log("navigator.share available:", !!navigator.share);
    console.log("navigator.clipboard available:", !!navigator.clipboard);
    console.log("shareData.url:", shareData.url);

    if (navigator.share) {
      try {
        console.log("Attempting navigator.share");
        await navigator.share(shareData);
        console.log("navigator.share successful");
        if (onSuccess) onSuccess();
      } catch (error) {
        console.error("navigator.share error:", error);
        if (error instanceof DOMException && error.name === "AbortError") {
          console.log("Share dialog aborted by user");
          return;
        }
        if (onError) onError(error);
      }
    } else if (navigator.clipboard && shareData.url) {
      try {
        console.log(
          "Attempting navigator.clipboard.writeText with URL:",
          shareData.url
        );
        await navigator.clipboard.writeText(shareData.url);
        console.log("navigator.clipboard.writeText successful");
        alert("Link copied to clipboard!");
        if (onSuccess) onSuccess();
      } catch (error) {
        console.error("navigator.clipboard.writeText error:", error);
        alert("Failed to copy link.");
        if (onError) onError(error);
      }
    } else {
      console.log(
        "Neither Web Share API nor Clipboard API with URL is available/suitable."
      );
      if (!navigator.share) {
        console.log("Reason: Web Share API not supported.");
      }
      if (!navigator.clipboard) {
        console.log("Reason: Clipboard API not supported.");
      }
      if (navigator.clipboard && !shareData.url) {
        console.log(
          "Reason: Clipboard API is supported, but no URL was provided in shareData."
        );
      }
      alert("Sharing not supported on this browser, or no URL to copy.");
    }
  };

  return (
    <Button onClick={handleClick}>
      <IconShare />
    </Button>
  );
};

export default ShareButton;
