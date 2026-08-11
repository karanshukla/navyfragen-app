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

// Chromium's multi-process architecture spawns a new renderer subprocess per
// tab (no --single-process). Without a cap, a burst of concurrent requests
// spawns one renderer per request, multiplying RSS. Excess requests queue
// instead of piling onto the browser at once.
export const MAX_CONCURRENT_RENDERS = 3;

class Semaphore {
  constructor(max) {
    this.max = max;
    this.current = 0;
    this.queue = [];
  }

  acquire() {
    if (this.current < this.max) {
      this.current++;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.current++;
        resolve();
      });
    });
  }

  release() {
    this.current--;
    const next = this.queue.shift();
    if (next) next();
  }
}

// Long enough to absorb a slow CDN fetch, short enough that a hung host cannot
// stall a render. A timeout screenshots anyway rather than failing the request.
const VISUAL_READINESS_TIMEOUT_MS = 8000;

function waitForWebfonts(page) {
  return page.evaluate(() => {
    if (document.fonts && document.fonts.ready) {
      return document.fonts.ready;
    }
    return Promise.resolve();
  });
}

function waitForDecodedImages(page) {
  return page
    .waitForFunction(
      () => Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0),
      { timeout: VISUAL_READINESS_TIMEOUT_MS }
    )
    .catch(() => {});
}

/**
 * page.goto's 'load' event fires once the HTML's direct resources resolve, but
 * CDN-hosted avatars/banners and webfonts are often still in flight then —
 * screenshotting at that point yields blank banners and fallback-font text.
 */
async function waitForVisualReadiness(page) {
  await Promise.all([waitForWebfonts(page), waitForDecodedImages(page)]);
}

// Railway's app-sleeping measures inactivity in *outbound packets*, and a
// resident Chromium is never that quiet: its component updater, safe-browsing
// lists, field trials, domain-reliability uploads, and mDNS/SSDP media-route
// discovery all emit traffic on timers with no page open. These flags silence
// those subsystems; the rest trim per-render RSS.
export const CHROMIUM_LAUNCH_ARGS = [
  '--no-sandbox',
  '--no-zygote',
  '--headless',
  '--disable-gpu',
  '--disable-background-networking',
  '--disable-component-update',
  '--disable-domain-reliability',
  '--disable-client-side-phishing-detection',
  '--disable-sync',
  '--safebrowsing-disable-auto-update',
  '--no-pings',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-default-apps',
  '--disable-breakpad',
  '--metrics-recording-only',
  '--disable-features=Translate,BackForwardCache,MediaRouter,DialMediaRouteProvider,OptimizationHints,InterestFeedContentSuggestions,AcceptCHFrame',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  '--disable-software-rasterizer',
  '--mute-audio',
];

// Must stay comfortably under Railway's 10-minute inactivity window, so a
// genuinely silent stretch can accumulate after the browser exits.
export const BROWSER_IDLE_TIMEOUT_MS = 90_000;

// Chromium accumulates RSS across renders even with every page closed, and
// under sustained traffic the idle timer never fires — so growth is bounded by
// forcing a close at the first moment nothing is in flight.
export const RENDERS_BEFORE_RECYCLE = 100;

// Launch on first use, close once idle: keeping Chromium out of the process
// between renders is what lets the container fall silent (and drops idle RSS
// from ~500MB to just the server). Do not prewarm it.
export function createBrowserPool({
  launch,
  idleTimeoutMs = BROWSER_IDLE_TIMEOUT_MS,
  rendersBeforeRecycle = RENDERS_BEFORE_RECYCLE,
  log = () => {},
} = {}) {
  let browserPromise = null;
  let rendersSinceLaunch = 0;
  let idleTimer = null;

  function cancelIdleClose() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  function scheduleIdleClose() {
    cancelIdleClose();
    idleTimer = setTimeout(() => {
      idleTimer = null;
      closeBrowser('idle');
    }, idleTimeoutMs);
    // Never let the idle timer be the reason the process stays alive.
    idleTimer.unref?.();
  }

  function startBrowser() {
    rendersSinceLaunch = 0;
    log('Launching browser...');
    browserPromise = launch().then((browser) => {
      log('Browser ready.');
      return browser;
    });
    return browserPromise;
  }

  async function discard(promise) {
    const browser = await promise.catch(() => null);
    if (browser) await browser.close().catch(() => {});
  }

  function closeBrowser(reason) {
    cancelIdleClose();
    const stale = browserPromise;
    browserPromise = null;
    if (!stale) return Promise.resolve();
    log(`Closing browser (${reason}).`);
    return discard(stale);
  }

  // A rejected launch must not be cached, or every later request inherits the
  // same failure and the service never recovers without a redeploy.
  async function resolveOrForget(promise) {
    try {
      return await promise;
    } catch (err) {
      if (browserPromise === promise) browserPromise = null;
      throw err;
    }
  }

  async function getBrowser() {
    cancelIdleClose();
    const pending = browserPromise ?? startBrowser();
    const browser = await resolveOrForget(pending);
    if (browser.connected) return browser;

    // The browser crashed out from under us. Relaunch, unless a concurrent
    // caller already noticed and did so.
    if (browserPromise === pending) {
      discard(pending);
      startBrowser();
    }
    return resolveOrForget(browserPromise ?? startBrowser());
  }

  function onRenderComplete(activeRenders) {
    rendersSinceLaunch++;
    // Closing mid-render would pull the browser out from under a request.
    if (activeRenders > 0) return;
    if (rendersSinceLaunch >= rendersBeforeRecycle) {
      closeBrowser(`recycle after ${rendersSinceLaunch} renders`);
    } else {
      scheduleIdleClose();
    }
  }

  // Launches ahead of a render the caller knows is coming. Arms the idle close
  // itself because no onRenderComplete follows a warm.
  //
  // @see [app.test.js](./app.test.js): 'a warm that is never followed by a
  // render still closes on idle' pins that this cannot pin the container awake.
  async function warm() {
    await getBrowser();
    scheduleIdleClose();
  }

  return {
    getBrowser,
    warm,
    onRenderComplete,
    shutdown: () => closeBrowser('shutdown'),
  };
}

export function createApp(getBrowser, { onRenderComplete = () => {}, warm = async () => {} } = {}) {
  const app = express();
  const renderSemaphore = new Semaphore(MAX_CONCURRENT_RENDERS);

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));

  // Health check responds immediately so Railway can mark the instance ready
  // without waiting for the browser to finish launching.
  app.get('/', (_req, res) => res.json({ status: 'ok' }));

  // Must stay ahead of the render validation below, which rejects a POST
  // carrying no 'source'.
  // @see [app.test.js](./app.test.js): 'is not rejected by the render
  // validation that requires a source body'.
  app.post('/warm', async (_req, res) => {
    try {
      await warm();
      res.json({ status: 'warm' });
    } catch (err) {
      res.status(503).json({ error: 'Browser unavailable: ' + err.message });
    }
  });

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
    await renderSemaphore.acquire();
    try {
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
    } finally {
      renderSemaphore.release();
      onRenderComplete(renderSemaphore.current);
    }
  });

  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

// Process bootstrap, skipped when app.test.js imports this module. The
// import-meta check is the gate because Bun honors no per-block coverage
// marker.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = 3033;

  const pool = createBrowserPool({
    launch: () =>
      puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        defaultViewport: { width: 1920, height: 1080 },
        args: CHROMIUM_LAUNCH_ARGS,
      }),
    log: (message) => console.log(message),
  });

  const app = createApp(pool.getBrowser, {
    onRenderComplete: pool.onRenderComplete,
    warm: pool.warm,
  });
  // Bind to :: so Railway's IPv6 internal network can reach this service.
  app.listen(port, '::', () => console.log(`html-to-image listening on port ${port}`));

  async function shutdown() {
    await pool.shutdown();
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
