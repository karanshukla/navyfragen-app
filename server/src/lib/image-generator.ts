import fetch from "node-fetch";
import type { Logger } from "pino";

interface ImageGenerationResult {
  imageBlob?: Buffer;
  imageAltText?: string;
}

export async function generateQuestionImage(
  originalMessage: string,
  hctiUserId: string | undefined,
  hctiApiKey: string | undefined,
  logger: Logger,
  userBskyHandle?: string
): Promise<ImageGenerationResult> {
  if (!hctiUserId || !hctiApiKey || !originalMessage) {
    logger.info(
      "Skipping image generation due to missing HCTI credentials or original message."
    );
    return {};
  }

  // Define a theme based on the new style request
  const theme = {
    imageBackgroundColor: "#1A1A1A", // Dark background
    cardGradientStart: "#007bff", // Blue for gradient
    cardGradientEnd: "#6f42c1", // Purple for gradient
    cardPadding: "1px", // Thickness of the gradient border itself - REMAINS MINIMAL
    cardBorderRadius: "10px", // Rounded corners for card
    headerTextColor: "#FFFFFF",
    messageBackgroundColor: "#FFFFFF",
    messageTextColor: "#000000",
    messagePadding: "25px", // Padding inside the white message box, around the text - REMAINS
    messageBorderRadius: "8px", // Rounded corners for message box (slightly less than card)
    footerTextColor: "#FFFFFF",
    fontFamily: "Noto Sans, sans-serif",
  };

  const footerText = userBskyHandle
    ? `navyfragen.app/profile/${userBskyHandle}`
    : "navyfragen.app";

  const html = `
    <div class="card">
      <h2 class="header-text">send me anonymous messages!</h2>
      <p class="message-text">${originalMessage.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
      <p class="footer-text">${footerText}</p>
    </div>
  `;

  const css = `
    body {
      margin: 0;
      font-family: ${theme.fontFamily};
      background-color: ${theme.imageBackgroundColor}; /* Overall image background */
      display: flex;
      justify-content: center;
      align-items: center;
      width: 1200px; /* Explicitly set to viewport_width */
      height: 630px; /* Viewport height */
      padding: 50px; /* This will be the thin outer dark border */
      box-sizing: border-box;
    }
    .card {
      background: linear-gradient(to right, ${theme.cardGradientStart}, ${theme.cardGradientEnd});
      border-radius: ${theme.cardBorderRadius};
      padding: ${theme.cardPadding}; /* This is the thickness of the gradient border itself */
      box-shadow: 0 2px 4px rgba(0,0,0,0.2); /* Softer shadow */
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: center;
      color: ${theme.headerTextColor};
    }
    .header-text {
      font-size: 24px; /* Smaller header to maximize message space */
      font-weight: bold;
      color: ${theme.headerTextColor};
      background-color: transparent;
      padding: 5px 0 0 0; /* Minimal top padding */
      margin: 0 0 3px 0; /* Small bottom margin to separate from message */
      text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
    }
    .message-text {
      font-size: 38px; /* Maintained for readability */
      color: ${theme.messageTextColor};
      background-color: ${theme.messageBackgroundColor};
      padding: ${theme.messagePadding}; /* Generous padding for text inside this box */
      border-radius: ${theme.messageBorderRadius};
      line-height: 1.45; /* Adjusted for visual balance with padding */
      white-space: pre-wrap;
      word-wrap: break-word;
      text-align: center;
      flex-grow: 1; 
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      margin: 0; /* No margin for the message box itself, relies on cardPadding */
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .footer-text {
      font-size: 16px; /* Smaller footer */
      color: ${theme.footerTextColor};
      opacity: 0.85; 
      text-align: center;
      padding: 0 0 5px 0; /* Minimal bottom padding */
      margin: 3px 0 0 0; /* Small top margin to separate from message */
      background-color: transparent;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
    }
  `;

  try {
    const imageApiRes = await fetch("https://hcti.io/v1/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " +
          Buffer.from(`${hctiUserId}:${hctiApiKey}`).toString("base64"),
      },
      body: JSON.stringify({
        html,
        css,
        google_fonts: "Noto Sans",
        viewport_width: 1200, // Specify viewport width
        viewport_height: 630, // Specify viewport height
      }),
    });

    if (imageApiRes.ok) {
      const imageResult = (await imageApiRes.json()) as { url: string };
      const imageUrl = imageResult.url;
      const imageDownloadRes = await fetch(imageUrl);

      if (imageDownloadRes.ok) {
        const arrayBuffer = await imageDownloadRes.arrayBuffer();
        const imageBlob = Buffer.from(arrayBuffer);
        const imageAltText = `Image of the anonymous question: \\"${originalMessage.substring(0, 100)}${originalMessage.length > 100 ? "..." : ""}\\"`;
        return { imageBlob, imageAltText };
      } else {
        logger.error(
          {
            error: await imageDownloadRes.text(),
            status: imageDownloadRes.status,
          },
          "Failed to download image from HCTI URL"
        );
        return {};
      }
    } else {
      logger.error(
        { error: await imageApiRes.text(), status: imageApiRes.status },
        "Failed to generate image with HCTI"
      );
      return {};
    }
  } catch (imgErr) {
    logger.error(imgErr, "Error during image generation/download process");
    return {};
  }
}
