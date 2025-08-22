import fetch from "node-fetch"; // Assuming 'node-fetch' v2 for response.buffer()
// If using node-fetch v3+, use response.arrayBuffer() then Buffer.from(await response.arrayBuffer())
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
    fontFamily:
      "'Noto Sans', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans TC', 'Noto Sans Arabic', 'Noto Sans Devanagari', 'Noto Sans Hebrew', 'Noto Sans Thai', 'Noto Sans Ethiopic', 'Noto Sans Georgian', 'Noto Sans Armenian', 'Noto Color Emoji', sans-serif", // Expanded font list
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
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+KR:wght@400;700&family=Noto+Sans+SC:wght@400;700&family=Noto+Sans+TC:wght@400;700&family=Noto+Sans+Arabic:wght@400;700&family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Hebrew:wght@400;700&family=Noto+Sans+Thai:wght@400;700&family=Noto+Sans+Ethiopic:wght@400;700&family=Noto+Sans+Georgian:wght@400;700&family=Noto+Sans+Armenian:wght@400;700&family=Noto+Color+Emoji&display=swap" rel="stylesheet">
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
        width: originalMessage.length <= 50 ? 450 : 568,
        height: originalMessage.length <= 50 ? 450 : 568,
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
  const scale = 0.5;

  // Helper to scale px values in a string (e.g., "48px")
  const px = (value: string) => {
    const num = parseFloat(value);
    return isNaN(num) ? value : `${num * scale}px`;
  };

  // Scale theme values
  const cardPadding = px(theme.cardPadding);
  const cardBorderRadius = px(theme.cardBorderRadius);
  const messagePadding = px(theme.messagePadding);
  const messageBorderRadius = px(theme.messageBorderRadius);
  const imageMargin = px(theme.imageMargin);

  // Dynamic font size and padding for message text
  let messageTextFontSize;
  let messageTextPaddingTop;
  if (messageLength <= 50) {
    messageTextFontSize = px("48px");
    messageTextPaddingTop = px("30px");
  } else if (messageLength <= 100) {
    messageTextFontSize = px("44px");
    messageTextPaddingTop = messagePadding;
  } else {
    messageTextFontSize = px("36px");
    messageTextPaddingTop = px("15px");
  }

  const messagePaddingCSS = `${messageTextPaddingTop} ${messagePadding} ${messagePadding} ${messagePadding}`;

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
      padding: ${imageMargin};
      box-sizing: border-box;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .card {
      background: linear-gradient(to right, ${theme.cardGradientStart}, ${theme.cardGradientEnd});
      border-radius: ${cardBorderRadius};
      padding: ${cardPadding};
      box-shadow: 0 ${2 * scale}px ${4 * scale}px rgba(0,0,0,0.2);
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
      font-size: ${px("72px")};
      font-weight: bold;
      color: ${theme.headerTextColor};
      padding: ${px("40px")} ${px("15px")} ${px("10px")} ${px("15px")};
      margin: 0 0 ${px("10px")} 0;
      text-shadow: ${px("1px")} ${px("1px")} ${px("2px")} rgba(0,0,0,0.2);
      width: 100%;
    }
    .message-text {
      font-size: ${messageTextFontSize};
      color: ${theme.messageTextColor};
      background-color: ${theme.messageBackgroundColor};
      padding: ${messagePaddingCSS};
      border-radius: ${messageBorderRadius};
      line-height: 1.4;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      text-align: center;
      margin: ${px("15px")} auto;
      max-width: 90%;
      max-height: 65%;
      overflow: hidden;
      box-shadow: 0 ${px("1px")} ${px("3px")} rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .footer-text {
      font-size: ${px("32px")};
      color: ${theme.footerTextColor};
      opacity: 0.85;
      text-align: center;
      padding: ${px("10px")} ${px("20px")} ${px("40px")} ${px("20px")};
      margin: ${px("10px")} 0 0 0;
      text-shadow: ${px("1px")} ${px("1px")} ${px("2px")} rgba(0,0,0,0.2);
      width: 100%;
    }
  `;
}

export const imageGenerator = {
  generateQuestionImage,
};
