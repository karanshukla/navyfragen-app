import fetch from "node-fetch";
import type { Logger } from "pino";
import { env } from "#/lib/env"; // Import env for EXPORT_HTML_URL

interface ImageGenerationResult {
  imageBlob?: Buffer;
  imageAltText?: string;
}

export async function generateQuestionImage(
  originalMessage: string,
  logger: Logger,
  userBskyHandle?: string
): Promise<ImageGenerationResult> {
  if (!originalMessage) {
    logger.info("Skipping image generation due to missing original message.");
    return {};
  }

  // Define a theme based on the new style request
  const theme = {
    imageBackgroundColor: "#1A1A1A", // Dark background
    cardGradientStart: "#007bff", // Blue for gradient
    cardGradientEnd: "#6f42c1", // Purple for gradient
    cardPadding: "20px", // Thickness of the gradient border itself
    cardBorderRadius: "10px", // Rounded corners for card
    headerTextColor: "#FFFFFF",
    messageBackgroundColor: "#FFFFFF",
    messageTextColor: "#000000",
    messagePadding: "20px", // Padding inside the white message box
    messageBorderRadius: "8px", // Rounded corners for message box
    footerTextColor: "#FFFFFF",
    fontFamily: "Noto Sans, sans-serif",
    imageMargin: "60px", // Margin around the card, inside the image bounds - INCREASED
  };

  const footerText = userBskyHandle
    ? `fragen.navy/${userBskyHandle}`
    : "navyfragen.app";

  const html = `
    <html>
      <head>
        <style>
          ${getCss(theme, originalMessage.length)}
        </style>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&display=swap" rel="stylesheet">
      </head>
      <body>
        <div class="card">
          <h2 class="header-text">send me anonymous messages!</h2>
          <p class="message-text">${originalMessage.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")}</p>
          <p class="footer-text">${footerText}</p>
        </div>
      </body>
    </html>
  `;

  try {
    logger.info(
      `Attempting to generate image via monkeyphysics/html-to-image service at: ${env.EXPORT_HTML_URL}`
    );
    const payload = {
      source: html,
      format: "png",
      options: {
        width: 700
        height: 1050, // Overall aspect ratio of 3:2
      },
    };

    const response = await fetch(env.EXPORT_HTML_URL, {
      // URL should be the root, e.g., http://localhost:3033/
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const imageBlob = await response.buffer(); // The service returns the image directly
      const imageAltText = `Image of the anonymous question: \"${originalMessage.substring(
        0,
        100
      )}${originalMessage.length > 100 ? "..." : ""}\"`;
      return { imageBlob, imageAltText };
    } else {
      logger.error(
        { error: await response.text(), status: response.status },
        "Failed to generate image with export-html service"
      );
      return {};
    }
  } catch (imgErr) {
    logger.error(imgErr, "Error during image generation process");
    return {};
  }
}

// Helper function to generate CSS string from theme object
function getCss(theme: any, messageLength: number): string {
  let messageTextFontSize;
  let messageTextPaddingTop;

  if (messageLength <= 50) {
    // Short message
    messageTextFontSize = "44px";
    messageTextPaddingTop = "30px";
  } else if (messageLength <= 100) {
    // Medium message
    messageTextFontSize = "40px";
    messageTextPaddingTop = theme.messagePadding; // Uses the default "20px"
  } else {
    // Long message
    messageTextFontSize = "32px";
    messageTextPaddingTop = "15px"; // Slightly reduced top padding for very long messages
  }

  // Construct the full padding string, keeping other sides as per theme.messagePadding
  const messagePaddingCSS = `${messageTextPaddingTop} ${theme.messagePadding} ${theme.messagePadding} ${theme.messagePadding}`;

  return `
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    body {
      font-family: ${theme.fontFamily};
      background-color: ${theme.imageBackgroundColor}; /* Dark background */
      width: 900px; /* Overall image width - Maintained */
      height: 700px; /* Overall image height - INCREASED */
      padding: ${theme.imageMargin}; /* Space around the .card */
      box-sizing: border-box; /* padding is included in width/height */
      display: flex; /* Ensures .card can expand to fill if needed */
      justify-content: center; /* Centers .card if it's smaller */
      align-items: center; /* Centers .card if it's smaller */
      overflow: hidden; /* Ensure nothing spills out */
    }
    .card {
      background: linear-gradient(to right, ${theme.cardGradientStart}, ${theme.cardGradientEnd}); /* Gradient */
      border-radius: ${theme.cardBorderRadius};
      padding: ${theme.cardPadding}; /* This is the gradient border thickness */
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      width: 100%; /* Fill the space provided by body's content box (body_size - 2*imageMargin) */
      height: 100%; /* Fill the space provided by body's content box */
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: flex-start; /* MODIFIED: Align content to the top */
      align-items: center; /* Horizontally center content (like .message-text if not full width) */
      text-align: center; /* Default text alignment for children */
    }
    .header-text {
      font-size: 52px; /* INCREASED */
      font-weight: bold;
      color: ${theme.headerTextColor};
      background-color: transparent;
      padding: 20px 15px 10px 15px;
      margin: 0 0 10px 0;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
      width: 100%; /* Take full width of .card's content area */
    }
    .message-text {
      font-size: ${messageTextFontSize}; /* DYNAMIC font size based on length */
      color: ${theme.messageTextColor};
      background-color: ${theme.messageBackgroundColor}; /* White box for the message */
      padding: ${messagePaddingCSS}; /* DYNAMIC padding based on length */
      border-radius: ${theme.messageBorderRadius};
      line-height: 1.4;
      white-space: pre-wrap;
      overflow-wrap: break-word; /* STANDARD PROPERTY for word wrapping */
      text-align: center;
      margin: 15px auto; /* Vertical margin, auto for horizontal centering */
      max-width: 90%; /* Max width of the white box - INCREASED */
      max-height: 65%; /* Max height of the white box - INCREASED */
      overflow: hidden; /* Clip content if too long, but box is now larger */
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .footer-text {
      font-size: 32px; /* INCREASED */
      color: ${theme.footerTextColor};
      opacity: 0.85;
      text-align: center;
      padding: 10px 20px 15px 20px;
      margin: 10px 0 0 0; /* Original margin, top will be overridden */
      margin-top: auto; /* ADDED: Push footer to the bottom */
      background-color: transparent;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
      width: 100%; /* Take full width of .card's content area */
    }
  `;
}
