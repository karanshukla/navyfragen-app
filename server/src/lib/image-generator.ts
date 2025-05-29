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

  // Define a theme similar to the app's aesthetic
  const theme = {
    backgroundColor: "#1A1A1A", // Dark background for the overall image
    cardBackgroundColor: "#2B2B2B", // Slightly lighter dark for the card/box - NO LONGER USED FOR CARD BG
    navyBoxColor: "#000080", // Navy blue for the content box
    textColor: "#E0E0E0", // Light grey/off-white text
    fontFamily: "Noto Sans, Arial, sans-serif",
    cardMaxWidth: "1100px", // Increased max width
    cardPadding: "55px", // Slightly increased padding
    borderRadius: "15px", // Slightly more rounded
  };

  const footerText = userBskyHandle
    ? `navyfragen.app/profile/${userBskyHandle}`
    : "navyfragen.app";

  const html = `
    <div class="card">
      <p class="header-text">Anonymous Question:</p>
      <p class="message-text">${originalMessage.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
      <p class="footer-text">${footerText}</p>
    </div>
  `;

  const css = `
    body {
      margin: 0;
      font-family: ${theme.fontFamily};
      background-color: ${theme.backgroundColor};
      display: flex;
      justify-content: center;
      align-items: center;
      width: 1200px; /* Viewport width */
      height: 630px; /* Viewport height */
      padding: 15px; /* Reduced body padding to make card appear larger */
      box-sizing: border-box;
    }
    .card {
      background-color: ${theme.navyBoxColor};
      border-radius: ${theme.borderRadius};
      padding: ${theme.cardPadding};
      box-shadow: 0 8px 20px rgba(0,0,0,0.4); /* Enhanced shadow */
      width: 100%; /* Card takes full width of padded body */
      height: 100%; /* Card takes full height of padded body */
      max-width: ${theme.cardMaxWidth};
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between; /* Distribute space: header top, footer bottom, message middle */
    }
    .header-text {
      font-size: 32px; /* Increased font size */
      font-weight: bold;
      color: ${theme.textColor};
      margin-top: 0;
      margin-bottom: 30px; /* Increased margin */
      text-align: center;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.5); /* Added text shadow */
    }
    .message-text {
      font-size: 42px; /* Increased font size */
      color: ${theme.textColor};
      line-height: 1.5; /* Adjusted line height */
      white-space: pre-wrap;
      word-wrap: break-word;
      text-align: center;
      flex-grow: 1; /* Allows this to take up available vertical space */
      display: flex;
      flex-direction: column;
      justify-content: center; /* Vertically center the text block */
      align-items: center; /* Horizontally center the text block */
      margin-top: 25px; /* Add some margin from header */
      margin-bottom: 25px; /* Add some margin before footer */
      overflow: hidden; /* Prevent text from overflowing card if too long */
      text-shadow: 1px 1px 3px rgba(0,0,0,0.6); /* Added text shadow */
    }
    .footer-text {
      font-size: 24px; /* Increased font size */
      color: ${theme.textColor};
      opacity: 0.8; /* Slightly more visible */
      text-align: center;
      margin-top: auto; /* Pushes footer to the bottom of the card */
      padding-top: 25px; /* Space above the footer text itself */
      text-shadow: 1px 1px 2px rgba(0,0,0,0.5); /* Added text shadow */
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
