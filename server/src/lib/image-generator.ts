import fetch from "node-fetch";
import sharp from "sharp";
import type { Logger } from "pino";
import { env } from "#/lib/env";

interface ImageGenerationResult {
  imageBlob?: Buffer;
  imageAltText?: string;
  width?: number;
  height?: number;
}

const PRECONNECT = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`;

const NOTO_LINK = `<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+KR:wght@400;700&family=Noto+Sans+SC:wght@400;700&family=Noto+Sans+TC:wght@400;700&family=Noto+Sans+Arabic:wght@400;700&family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Hebrew:wght@400;700&family=Noto+Sans+Thai:wght@400;700&family=Noto+Color+Emoji&display=swap" rel="stylesheet">`;

const NOTO_STACK = `'Noto Sans', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans TC', 'Noto Sans Arabic', 'Noto Sans Devanagari', 'Noto Sans Hebrew', 'Noto Sans Thai', 'Noto Color Emoji', sans-serif`;

const BASE_CSS = `
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html { overflow: hidden; zoom: 4; }
  body { overflow: hidden; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; font-synthesis: none; }
`;

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

  const footerText = userBskyHandle
    ? `fragen.navy/${userBskyHandle}`
    : "navyfragen.app";

  const escapedMessage = originalMessage
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const { html, width, height } = generateThemeSpecificHtml(
    themeName,
    escapedMessage,
    footerText,
    originalMessage.length
  );

  try {
    logger.info(`Attempting to generate image via service at: ${env.EXPORT_HTML_URL}`);
    const payload = {
      source: html,
      format: "png",
      options: {
        width: width * 4,
        height: height * 4,
      },
    };
    const response = await fetch(env.EXPORT_HTML_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const raw = await response.buffer();
      const imageBlob = await sharp(raw)
        .resize(width * 2, height * 2, { kernel: sharp.kernel.lanczos3 })
        .png({ compressionLevel: 9 })
        .toBuffer();
      const imageAltText = `Image of the anonymous question: "${originalMessage}" - Answered on Navyfragen.app`;
      return { imageBlob, imageAltText, width: width * 2, height: height * 2 };
    } else {
      const errorBody = await response.text();
      logger.error(
        { error: errorBody, status: response.status },
        "Failed to generate image with export-html service"
      );
      if (response.status >= 400 && response.status < 500) {
        logger.debug({ htmlSent: html }, "HTML sent to image service (client error)");
      }
      return {};
    }
  } catch (imgErr) {
    logger.error(imgErr, "Error during image generation process");
    return {};
  }
}

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

function msgFontSize(length: number, large: number, medium: number, small: number): number {
  if (length <= 60) return large;
  if (length <= 120) return medium;
  return small;
}

function nglHeight(length: number): number {
  if (length <= 40) return 200;
  if (length <= 80) return 230;
  if (length <= 130) return 265;
  if (length <= 200) return 310;
  if (length <= 300) return 355;
  return 395;
}

function compressedHeight(length: number): number {
  if (length <= 40) return 115;
  if (length <= 80) return 136;
  if (length <= 130) return 158;
  if (length <= 200) return 190;
  if (length <= 300) return 228;
  return 262;
}

function twitterHeight(length: number): number {
  if (length <= 40) return 170;
  if (length <= 80) return 195;
  if (length <= 130) return 218;
  if (length <= 200) return 255;
  if (length <= 300) return 288;
  return 318;
}

// Default theme: NGL-style — vivid purple gradient, large prominent white bubble
function generateDefaultHtml(
  escapedMessage: string,
  footerText: string,
  messageLength: number
): { html: string; width: number; height: number } {
  const width = 360;
  const height = nglHeight(messageLength);
  const fontSize = msgFontSize(messageLength, 26, 21, 17);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${PRECONNECT}
  ${NOTO_LINK}
  <style>
    ${BASE_CSS}
    html, body {
      width: ${width}px;
      height: ${height}px;
      font-family: ${NOTO_STACK};
    }
    body {
      background: linear-gradient(145deg, #7c3aed 0%, #2563eb 100%);
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: space-between;
    }
    .header {
      color: rgba(255, 255, 255, 0.90);
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 1px;
      text-align: center;
      text-transform: uppercase;
      line-height: 1.4;
    }
    .bubble {
      background: #ffffff;
      border-radius: 16px;
      padding: 12px 18px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.30);
      overflow: hidden;
    }
    .message {
      color: #111111;
      font-size: ${fontSize}px;
      font-weight: 600;
      line-height: 1.45;
      text-align: center;
      word-break: break-word;
      overflow-wrap: break-word;
      width: 100%;
    }
    .footer {
      color: rgba(255, 255, 255, 0.62);
      font-size: 11px;
      font-weight: 400;
      text-align: center;
      flex-shrink: 0;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <p class="header">send me anonymous messages</p>
  <div class="bubble">
    <p class="message">${escapedMessage}</p>
  </div>
  <p class="footer">${footerText}</p>
</body>
</html>`;

  return { html, width, height };
}

// Compressed theme: Dark compact card with left accent border
function generateCompressedHtml(
  escapedMessage: string,
  footerText: string,
  messageLength: number
): { html: string; width: number; height: number } {
  const width = 380;
  const height = compressedHeight(messageLength);
  const fontSize = msgFontSize(messageLength, 19, 16, 14);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${PRECONNECT}
  ${NOTO_LINK}
  <style>
    ${BASE_CSS}
    html, body {
      width: ${width}px;
      height: ${height}px;
      font-family: ${NOTO_STACK};
    }
    body {
      background: #1a1a2a;
      padding: 12px;
      display: flex;
      align-items: stretch;
    }
    .card {
      background: #22223a;
      border-radius: 10px;
      border-left: 4px solid #7c3aed;
      padding: 12px 14px 12px 13px;
      width: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .label {
      font-size: 9px;
      font-weight: 700;
      color: #a78bfa;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }
    .message {
      color: #f0f0ff;
      font-size: ${fontSize}px;
      font-weight: 600;
      line-height: 1.45;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    .footer {
      font-size: 10px;
      color: #6b7280;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div>
      <div class="label">Anonymous Question</div>
      <div class="message">${escapedMessage}</div>
    </div>
    <div class="footer">${footerText}</div>
  </div>
</body>
</html>`;

  return { html, width, height };
}

// Twitter theme: X/Twitter post card — profile header, tweet body, link footer
function generateTwitterHtml(
  escapedMessage: string,
  footerText: string,
  messageLength: number
): { html: string; width: number; height: number } {
  const width = 420;
  const height = twitterHeight(messageLength);
  const fontSize = msgFontSize(messageLength, 21, 17, 14);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${PRECONNECT}
  ${NOTO_LINK}
  <style>
    ${BASE_CSS}
    html, body {
      width: ${width}px;
      height: ${height}px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', ${NOTO_STACK};
    }
    body {
      background: #f7f9f9;
      padding: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #ffffff;
      border: 1px solid #cfd9de;
      border-radius: 16px;
      padding: 14px 16px 12px;
      width: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
      margin-bottom: 10px;
    }
    .avatar {
      width: 36px;
      height: 36px;
      min-width: 36px;
      border-radius: 50%;
      background: #1d9bf0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 13px;
      font-weight: 700;
    }
    .user-info {
      flex: 1;
      min-width: 0;
    }
    .name-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .user-name {
      font-size: 14px;
      font-weight: 700;
      color: #0f1419;
      line-height: 1.3;
    }
    .verified {
      color: #1d9bf0;
      font-size: 14px;
      line-height: 1.3;
    }
    .user-handle {
      font-size: 13px;
      color: #536471;
      line-height: 1.3;
    }
    .content {
      overflow: visible;
    }
    .anon-label {
      font-size: 11px;
      color: #536471;
      margin-bottom: 4px;
    }
    .message {
      color: #0f1419;
      font-size: ${fontSize}px;
      font-weight: 400;
      line-height: 1.45;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    .footer {
      font-size: 12px;
      color: #1d9bf0;
      flex-shrink: 0;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #eff3f4;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="top">
      <div class="avatar">NF</div>
      <div class="user-info">
        <div class="name-row">
          <span class="user-name">NavyFragen</span>
          <span class="verified">&#10003;</span>
        </div>
        <div class="user-handle">@navyfragen</div>
      </div>
    </div>
    <div class="content">
      <div class="anon-label">received an anonymous question:</div>
      <div class="message">${escapedMessage}</div>
    </div>
    <div class="footer">${footerText}</div>
  </div>
</body>
</html>`;

  return { html, width, height };
}

export const imageGenerator = {
  generateQuestionImage,
};
