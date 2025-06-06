import fetch from "node-fetch"; // Assuming 'node-fetch' v2 for response.buffer()
// If using node-fetch v3+, response.arrayBuffer() then Buffer.from(await response.arrayBuffer())
import type { Logger } from "pino";
import { env } from "#/lib/env";

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

  const theme = {
    imageBackgroundColor: "#1A1A1A",
    cardGradientStart: "#007bff",
    cardGradientEnd: "#6f42c1",
    cardPadding: "20px",
    cardBorderRadius: "10px",
    headerTextColor: "#FFFFFF",
    messageBackgroundColor: "#FFFFFF",
    messageTextColor: "#000000",
    messagePadding: "20px",
    messageBorderRadius: "8px",
    footerTextColor: "#FFFFFF",
    fontFamily: "'Noto Sans', 'Noto Color Emoji', sans-serif",
    imageMargin: "60px",
  };

  const footerText = userBskyHandle
    ? `fragen.navy/${userBskyHandle}`
    : "navyfragen.app";

  // Basic HTML escaping for the message content
  const escapedMessage = originalMessage
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const html = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          ${getCss(theme, originalMessage.length)}
        </style>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Color+Emoji&display=swap" rel="stylesheet">
      </head>
      <body>
        <div class="card">
          <h2 class="header-text">send me anonymous messages!</h2>
          <p class="message-text">${escapedMessage}</p>
          <p class="footer-text">${footerText}</p>
        </div>
      </body>
    </html>
  `;

  try {
    logger.info(
      `Attempting to generate image via service at: ${env.EXPORT_HTML_URL}`
    );
    const payload = {
      source: html,
      format: "png",
      options: {
        width: 810,
        height: 810,
        args: {
          fullPage: true,
        },
      },
    };

    const response = await fetch(env.EXPORT_HTML_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const imageBlob = await response.buffer();
      const imageAltText = `Image of the anonymous question: \"${originalMessage}\" - Answered on Navyfragen.app`;

      return { imageBlob, imageAltText };
    } else {
      const errorBody = await response.text();
      logger.error(
        { error: errorBody, status: response.status },
        "Failed to generate image with export-html service"
      );

      // Log the HTML for debugging if the service fails
      if (response.status >= 400 && response.status < 500) {
        logger.debug(
          { htmlSent: html },
          "HTML content sent to image generation service (client error)"
        );
      }

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

  if (messageLength <= 50) {
    messageTextFontSize = "48px";
  } else if (messageLength <= 100) {
    messageTextFontSize = "44px";
  } else {
    messageTextFontSize = "36px";
  }

  // Ensure the font-family from the theme is used in the body or specific elements
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
      background-color: ${theme.imageBackgroundColor};
      padding: ${theme.imageMargin};
      box-sizing: border-box;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .card {
      background: linear-gradient(to right, ${theme.cardGradientStart}, ${theme.cardGradientEnd});
      border-radius: ${theme.cardBorderRadius};
      padding: ${theme.cardPadding};
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      width: 100%; 
      height: 100%; 
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      text-align: center;
    }    
      .header-text {
      font-size: 72px;
      font-weight: bold;
      color: ${theme.headerTextColor};
      padding: 40px 15px 10px 15px;
      margin: 0 0 10px 0;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
      width: 100%;
    }
    .message-text {
      font-size: ${messageTextFontSize};
      color: ${theme.messageTextColor};
      background-color: ${theme.messageBackgroundColor};
      padding: ${theme.messagePadding};
      border-radius: ${theme.messageBorderRadius};
      line-height: 1.4;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      text-align: center;
      margin: 15px auto;
      max-width: 90%;
      max-height: 65%;
      overflow: hidden; 
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      display: flex; 
      align-items: center;
      justify-content: center;
    }
    .footer-text {
      font-size: 32px;
      color: ${theme.footerTextColor};
      opacity: 0.85;
      text-align: center;
      padding: 10px 20px 40px 20px;
      margin: 10px 0 0 0;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
      width: 100%;
    }
  `;
}
