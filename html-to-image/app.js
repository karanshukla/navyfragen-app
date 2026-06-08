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
  const port = parseInt(process.env.PORT ?? '3033', 10);

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
  app.listen(port, () => console.log(`html-to-image listening on port ${port}`));

  async function shutdown() {
    const browser = await browserPromise.catch(() => null);
    if (browser) await browser.close().catch(() => {});
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
