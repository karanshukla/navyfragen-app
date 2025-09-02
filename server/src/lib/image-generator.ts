import { themes, Theme } from "#/lib/themes";
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
  userBskyHandle?: string,
  themeName: string = "default"
): Promise<ImageGenerationResult> {
  if (!originalMessage) {
    logger.info("Skipping image generation due to missing original message.");
    return {};
  }

  const theme = themes[themeName] || themes.default;

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

  // Generate theme-specific HTML and dimensions
  const { html, width, height } = generateThemeSpecificHtml(
    themeName,
    escapedMessage,
    footerText,
    originalMessage.length
  );

  try {
    logger.info(
      `Attempting to generate image via service at: ${env.EXPORT_HTML_URL}`
    );
    const payload = {
      source: html,
      format: "png",
      options: {
        width,
        height,
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

// Generate theme-specific HTML layouts
function generateThemeSpecificHtml(
  themeName: string,
  escapedMessage: string,
  footerText: string,
  messageLength: number
): { html: string; width: number; height: number } {
  switch (themeName) {
    case "compressed":
      return generateCompressedHtml(escapedMessage, footerText, messageLength);
    case "twitter":
      return generateTwitterHtml(escapedMessage, footerText, messageLength);
    default:
      return generateDefaultHtml(escapedMessage, footerText, messageLength);
  }
}

// Default theme: Rich, colorful design
function generateDefaultHtml(
  escapedMessage: string,
  footerText: string,
  messageLength: number
): { html: string; width: number; height: number } {
  const theme = themes.default;
  // Use consistent 1:1 (square) aspect ratio for social media compatibility
  const width = 500;
  const height = 500;

  const html = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          ${getDefaultCss(theme, messageLength)}
        </style>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+KR:wght@400;700&family=Noto+Sans+SC:wght@400;700&family=Noto+Sans+TC:wght@400;700&family=Noto+Sans+Arabic:wght@400;700&family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Hebrew:wght@400;700&family=Noto+Sans+Thai:wght@400;700&family=Noto+Sans+Ethiopic:wght@400;700&family=Noto+Sans+Georgian:wght@400;700&family=Noto+Sans+Armenian&family=Noto+Color+Emoji&display=swap" rel="stylesheet">
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

  return { html, width, height };
}

// Compressed theme: Minimal, compact design
function generateCompressedHtml(
  escapedMessage: string,
  footerText: string,
  messageLength: number
): { html: string; width: number; height: number } {
  // Much smaller, truly compressed size but accounting for up to 150 characters
  const width = 320;
  const height = Math.max(
    160,
    Math.min(240, 120 + Math.ceil(messageLength / 25) * 12)
  );

  const html = `
    <html>
      <head>
        <meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+KR:wght@400;700&family=Noto+Sans+SC:wght@400;700&family=Noto+Sans+TC:wght@400;700&family=Noto+Sans+Arabic:wght@400;700&family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Hebrew:wght@400;700&family=Noto+Sans+Thai:wght@400;700&family=Noto+Sans+Ethiopic:wght@400;700&family=Noto+Sans+Georgian:wght@400;700&family=Noto+Sans+Armenian&family=Noto+Color+Emoji&display=swap" rel="stylesheet">
        <style>
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background-color: #f8f9fa;
            font-family: 'Noto Sans', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans TC', 'Noto Sans Arabic', 'Noto Sans Devanagari', 'Noto Sans Hebrew', 'Noto Sans Thai', 'Noto Sans Ethiopic', 'Noto Sans Georgian', 'Noto Sans Armenian', 'Noto Color Emoji', sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }
          body {
            padding: 8px;
            box-sizing: border-box;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            width: 100vw;
          }
          .card {
            background: #ffffff;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            padding: 12px;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            box-shadow: 0 1px 2px rgba(0,0,0,0.08);
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .header {
            font-size: 12px;
            font-weight: 600;
            color: #6c757d;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-bottom: 8px;
            text-align: center;
            flex-shrink: 0;
          }
          .message {
            font-size: 16px;
            color: #212529;
            line-height: 1.3;
            text-align: center;
            margin: 0;
            word-wrap: break-word;
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 500;
          }
          .footer {
            font-size: 11px;
            color: #868e96;
            text-align: center;
            margin-top: 8px;
            opacity: 0.8;
            flex-shrink: 0;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">Anonymous Question via Navyfragen</div>
          <div class="message">${escapedMessage}</div>
          <div class="footer">${footerText}</div>
        </div>
      </body>
    </html>
  `;

  return { html, width, height };
}

// Twitter theme: Classic Twitter design (peak era)
function generateTwitterHtml(
  escapedMessage: string,
  footerText: string,
  messageLength: number
): { html: string; width: number; height: number } {
  // Much tighter height calculation to minimize whitespace
  const width = 560;
  const baseHeight = 200;
  const additionalHeight = Math.ceil(messageLength / 80) * 15; // Much less aggressive scaling
  const height = Math.max(200, Math.min(280, baseHeight + additionalHeight));

  const html = `
    <html>
      <head>
        <meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+KR:wght@400;700&family=Noto+Sans+SC:wght@400;700&family=Noto+Sans+TC:wght@400;700&family=Noto+Sans+Arabic:wght@400;700&family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Hebrew:wght@400;700&family=Noto+Sans+Thai:wght@400;700&family=Noto+Sans+Ethiopic:wght@400;700&family=Noto+Sans+Georgian:wght@400;700&family=Noto+Sans+Armenian&family=Noto+Color+Emoji&display=swap" rel="stylesheet">
        <style>
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background-color: #f5f8fa;
            font-family: 'Noto Sans', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans TC', 'Noto Sans Arabic', 'Noto Sans Devanagari', 'Noto Sans Hebrew', 'Noto Sans Thai', 'Noto Sans Ethiopic', 'Noto Sans Georgian', 'Noto Sans Armenian', 'Noto Color Emoji', sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }
          body {
            padding: 8px;
            box-sizing: border-box;
            display: flex;
            align-items: flex-start;
            height: 100vh;
            width: 100vw;
          }
          .tweet-container {
            background: #ffffff;
            border: 1px solid #e1e8ed;
            border-radius: 12px;
            padding: 0;
            width: 100%;
            box-sizing: border-box;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            display: flex;
            flex-direction: column;
            min-height: fit-content;
          }
          .tweet-header {
            display: flex;
            align-items: center;
            padding: 12px 16px 8px 16px;
            flex-shrink: 0;
          }
          .avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: linear-gradient(135deg, #1da1f2, #0084b4);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 18px;
            margin-right: 12px;
            flex-shrink: 0;
          }
          .tweet-main {
            flex: 1;
            min-width: 0;
          }
          .user-info {
            display: flex;
            align-items: center;
            margin-bottom: 2px;
          }
          .display-name {
            font-weight: 700;
            font-size: 15px;
            color: #14171a;
            margin-right: 4px;
          }
          .username {
            font-size: 15px;
            color: #657786;
          }
          .tweet-body {
            padding: 2px 16px 0 16px;
            display: flex;
            flex-direction: column;
            min-height: 0;
          }
          .question-badge {
            background: #e8f4f8;
            color: #1da1f2;
            font-size: 11px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 12px;
            margin: 0 0 8px 0;
            display: inline-block;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            align-self: flex-start;
          }
          .tweet-content {
            font-size: 23px;
            color: #14171a;
            line-height: 28px;
            margin: 0 0 12px 0;
            word-wrap: break-word;
            font-weight: 400;
            text-align: left;
          }
          .tweet-footer {
            padding: 4px 16px 12px 16px;
            flex-shrink: 0;
          }
          .website-link {
            font-size: 13px;
            color: #1da1f2;
            text-decoration: none;
            font-weight: 400;
            display: inline-block;
          }
          .website-link:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="tweet-container">
          <div class="tweet-header">
            <div class="avatar">NF</div>
            <div class="tweet-main">
              <div class="user-info">
                <span class="display-name">NavyFragen</span>
                <span class="username">@navyfragen</span>
              </div>
            </div>
          </div>
          <div class="tweet-body">
            <div class="question-badge">Anonymous Question</div>
            <div class="tweet-content">${escapedMessage}</div>
          </div>
          <div class="tweet-footer">
            <a href="#" class="website-link">${footerText}</a>
          </div>
        </div>
      </body>
    </html>
  `;

  return { html, width, height };
}

// Helper function to generate CSS string for default theme
function getDefaultCss(theme: any, messageLength: number): string {
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
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
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
