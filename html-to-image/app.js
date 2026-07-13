import puppeteer from 'puppeteer';
import express from 'express';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import fs from 'fs';
import tmp from 'tmp';
import { fileURLToPath } from 'url';

const FORMATS = {
  png:  { contentType: 'image/png',  args: { type: 'png'  } },
  jpg:  { contentType: 'image/jpeg', args: { type: 'jpeg' } },
  jpeg: { contentType: 'image/jpeg', args: { type: 'jpeg' } },
  webp: { contentType: 'image/webp', args: { type: 'webp' } },
};

// Bounded deadline for waiting on images/fonts to load before a screenshot.
// Long enough to absorb a slow CDN fetch (banners/avatars live on cdn.bsky.app,
// fonts on fonts.googleapis.com), short enough that a hung host can't stall a
// render. On timeout we proceed with the screenshot anyway — the common case
// will have loaded, the pathological case degrades to the pre-fix behavior.
const VISUAL_READINESS_TIMEOUT_MS = 8000;

// waitForVisualReadiness blocks until the page's webfonts and <img> elements
// have loaded, so the screenshot doesn't race background-image/avatar fetches.
// Without this, page.goto's 'load' event (the default wait) fires as soon as
// the HTML's direct resources resolve, but CSS background-image and <img>
// sources from a CDN (e.g. cdn.bsky.app banners/avatars) and webfonts are
// frequently still in flight — producing flaky renders with blank banners or
// fallback-font text. document.fonts.ready covers the FontFaceSet; the in-page
// function covers <img> completeness. Both settle quickly on a local file URL
// with no external assets.
async function waitForVisualReadiness(page) {
  await Promise.all([
    // Best-effort font load. document.fonts.ready resolves once the FontFaceSet
    // settles (all @font-face faces that the page actually uses have loaded or
    // failed). Guarded — very old Chromium lacks document.fonts, though 23.x
    // always has it.
    page.evaluate(() => {
      if (document.fonts && document.fonts.ready) {
        return document.fonts.ready;
      }
      return Promise.resolve();
    }),
    // Every <img> must be complete with a non-zero naturalWidth (i.e. decoded,
    // not broken/empty). waitForFunction polls until the predicate holds or
    // the timeout elapses; on timeout it rejects, which we swallow so the
    // screenshot still fires.
    page.waitForFunction(
      () => Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0),
      { timeout: VISUAL_READINESS_TIMEOUT_MS }
    ).catch(() => {}),
  ]);
}

export function createApp(getBrowser) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));

  // Health check responds immediately so Railway can mark the instance ready
  // without waiting for the browser to finish launching.
  app.get('/', (_req, res) => res.json({ status: 'ok' }));

  app.use((req, res, next) => {
    if (req.method !== 'POST') return next({ status: 405, message: 'Method not allowed' });
    if (req.get('Content-Type') !== 'application/json') {
      return next({ status: 415, message: "Only 'application/json' is supported" });
    }
    if (typeof req.body.source !== 'string') {
      return next({ status: 400, message: "Missing 'source' property in request body, or 'source' is not a string" });
    }
    if (req.body.source === '') {
      return next({ status: 400, message: "'source' must not be empty" });
    }
    if (!FORMATS[req.body.format]) {
      return next({ status: 400, message: `'format' must be one of: ${Object.keys(FORMATS).join(', ')}` });
    }
    if (req.body.options !== undefined && (typeof req.body.options !== 'object' || Array.isArray(req.body.options))) {
      return next({ status: 400, message: "'options' must be an object if provided" });
    }
    next();
  });

  app.post('/', async (req, res) => {
    let browser;
    try {
      browser = await getBrowser();
    } catch (err) {
      return res.status(503).json({ error: 'Browser unavailable: ' + err.message });
    }

    const { source, format: formatName, options = {} } = req.body;
    const format = FORMATS[formatName];
    const tmpoutput = tmp.fileSync({ prefix: 'htmltoimage-' });
    const tmpinput = tmp.fileSync({ prefix: 'htmltoimage-', postfix: '.html' });

    try {
      await fs.promises.writeFile(tmpinput.name, source);

      const page = await browser.newPage();
      try {
        await page.setViewport({ width: options.width || 1920, height: options.height || 1080 });
        await page.goto('file://' + tmpinput.name);
        await waitForVisualReadiness(page);
        await page.screenshot(Object.assign({}, options.args, format.args, { path: tmpoutput.name }));
      } finally {
        await page.close();
      }

      res.header('Content-Type', format.contentType);
      fs.createReadStream(tmpoutput.name).pipe(res).on('close', () => {
        tmpoutput.removeCallback();
        tmpinput.removeCallback();
      });
    } catch (err) {
      tmpoutput.removeCallback();
      tmpinput.removeCallback();
      res.status(500).json({ error: err.message || 'Image generation failed' });
    }
  });

  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

// Only run when this file is the entry point, not when imported by tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = 3033;

  function launchBrowser() {
    console.log('Launching browser...');
    return puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      defaultViewport: { width: 1920, height: 1080 },
      args: ['--no-sandbox', '--no-zygote', '--headless', '--disable-gpu'],
    }).then(b => { console.log('Browser ready.'); return b; });
  }

  let browserPromise = launchBrowser();

  async function getBrowser() {
    const browser = await browserPromise;
    if (!browser.connected) {
      browserPromise = launchBrowser();
      return browserPromise;
    }
    return browser;
  }

  const app = createApp(getBrowser);
  // Bind to :: so Railway's IPv6 internal network can reach this service.
  app.listen(port, '::', () => console.log(`html-to-image listening on port ${port}`));

  async function shutdown() {
    const browser = await browserPromise.catch(() => null);
    if (browser) await browser.close().catch(() => {});
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
