import sharp from "sharp";
import type { Logger } from "pino";
import { env } from "#/lib/env";

const LOGO_DATA_URL = "data:image/png;base64,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";


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

// Retries a fetch on network errors (ECONNREFUSED, ETIMEDOUT, etc.) for up to
// timeoutMs. Does not retry HTTP error responses — those mean the service is up.
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const deadline = Date.now() + timeoutMs;
  let delay = 500;
  let lastError: unknown;
  while (true) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastError = err;
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise((r) => setTimeout(r, Math.min(delay, remaining)));
    delay = Math.min(Math.ceil(delay * 1.5), 2000);
  }
  throw lastError;
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
    originalMessage.length,
    userBskyHandle
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
    const response = await fetchWithRetry(
      env.EXPORT_HTML_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      10_000
    );

    if (response.ok) {
      const raw = Buffer.from(await response.arrayBuffer());
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
  messageLength: number,
  handle?: string
): { html: string; width: number; height: number } {
  switch (themeName) {
    case "compressed":
      return generateCompressedHtml(escapedMessage, footerText, messageLength);
    case "twitter":
      return generateTwitterHtml(escapedMessage, footerText, messageLength, handle);
    default:
      return generateDefaultHtml(escapedMessage, footerText, messageLength);
  }
}

function msgFontSize(length: number, large: number, medium: number, small: number): number {
  if (length <= 60) return large;
  if (length <= 120) return medium;
  return small;
}

// Estimates rendered line count using avg char width (0.58× font size for Noto Sans),
// with a 20% buffer for word wrapping and character width variance.
function estimateLines(messageLength: number, fontSize: number, areaWidth: number): number {
  const charsPerLine = Math.max(1, Math.floor(areaWidth / (fontSize * 0.58)));
  return Math.max(1, Math.ceil((messageLength / charsPerLine) * 1.2));
}

function nglHeight(length: number): number {
  const fontSize = msgFontSize(length, 26, 21, 17);
  // message area: 360px wide − 32px body padding − 36px bubble padding (18px each side)
  const lines = estimateLines(length, fontSize, 292);
  const bubbleH = Math.ceil(lines * fontSize * 1.45) + 24; // 24 = 12px top + 12px bottom bubble padding
  // fixed chrome: 16 top pad + 20 header + 10 gap + 10 gap + 16 footer + 16 bottom pad = 88
  return Math.max(bubbleH + 88, 180);
}

function compressedHeight(length: number): number {
  const fontSize = msgFontSize(length, 19, 16, 14);
  // message area: 380px − 24px body padding − 4px border − 27px card padding (13px+14px)
  const lines = estimateLines(length, fontSize, 325);
  const textH = Math.ceil(lines * fontSize * 1.45);
  // fixed chrome: 24 body pad + 24 card pad + 9 label + 6 label-margin + 8 footer-margin + 10 footer = 81
  return Math.max(textH + 81, 100);
}

function twitterHeight(length: number, handle?: string): number {
  const fontSize = msgFontSize(length, 21, 17, 14);
  // message area: 420px − 32px card padding (16px each side)
  const effectiveLength = handle ? length + handle.length + 2 : length;
  const lines = estimateLines(effectiveLength, fontSize, 388);
  const textH = Math.ceil(lines * fontSize * 1.45);
  // fixed chrome: 14 card-top + 36 avatar-row + 10 header-margin + 37 footer (margin+pad+border+text) + 12 card-bottom = 109
  return Math.max(textH + 109, 140);
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
      background: linear-gradient(135deg, #1E1B4B 0%, #3B2E78 55%, #6B3FD4 100%);
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
      justify-content: space-between;
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
  messageLength: number,
  handle?: string
): { html: string; width: number; height: number } {
  const width = 420;
  const height = twitterHeight(messageLength, handle);
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
      background: #ffffff;
      padding: 0;
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
      overflow: hidden;
      background: #1d9bf0;
    }
    .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
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
    .mention {
      color: #1d9bf0;
      font-weight: 400;
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
      <div class="avatar">${LOGO_DATA_URL ? `<img src="${LOGO_DATA_URL}" alt="Navyfragen logo" />` : "NF"}</div>
      <div class="user-info">
        <div class="name-row">
          <span class="user-name">Navyfragen - Anonymous QnA</span>
          <span class="verified">🔷📩</span>
        </div>
        <div class="user-handle">@navyfragen.app</div>
      </div>
    </div>
    <div class="content">
      <div class="message">${handle ? `<span class="mention">@${handle}</span> ` : ""}${escapedMessage}</div>
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
