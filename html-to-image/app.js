import puppeteer from 'puppeteer';
import express from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import tmp from 'tmp';

const app = express();
const port = parseInt(process.env.PORT ?? '3033', 10);

const FORMATS = {
  png:  { contentType: 'image/png',      screenshotType: 'png' },
  jpg:  { contentType: 'image/jpeg',     screenshotType: 'jpeg' },
  jpeg: { contentType: 'image/jpeg',     screenshotType: 'jpeg' },
  webp: { contentType: 'image/webp',     screenshotType: 'webp' },
  pdf:  { contentType: 'application/pdf', screenshotType: null },
};

app.use(express.json({ limit: '2mb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));

// Health check — used by Railway and other platforms to detect readiness
app.get('/', (_req, res) => res.json({ status: 'ok' }));

app.use((req, res, next) => {
  if (req.method !== 'POST') return next({ status: 405, message: 'Method not allowed' });
  if (req.get('Content-Type') !== 'application/json') {
    return next({ status: 415, message: "Only 'application/json' is supported" });
  }
  if (typeof req.body.source !== 'string' || req.body.source === '') {
    return next({ status: 400, message: "'source' must be a non-empty HTML string" });
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
  const { source, format: formatName, options = {} } = req.body;
  const format = FORMATS[formatName];
  const isPdf = formatName === 'pdf';

  const tmpinput = tmp.fileSync({ prefix: 'htmltoimage-', postfix: '.html' });
  const tmpoutput = tmp.fileSync({ prefix: 'htmltoimage-' });

  try {
    await fs.promises.writeFile(tmpinput.name, source);

    const page = await browser.newPage();
    try {
      await page.setViewport({ width: options.width || 1920, height: options.height || 1080 });
      await page.goto('file://' + tmpinput.name);

      if (isPdf) {
        await page.pdf({ format: 'A4', path: tmpoutput.name });
      } else {
        await page.screenshot({ type: format.screenshotType, path: tmpoutput.name });
      }
    } finally {
      await page.close();
    }

    res.header('Content-Type', format.contentType);
    fs.createReadStream(tmpoutput.name).pipe(res).on('close', () => {
      tmpinput.removeCallback();
      tmpoutput.removeCallback();
    });
  } catch (err) {
    tmpinput.removeCallback();
    tmpoutput.removeCallback();
    res.status(500).json({ error: err.message || 'Image generation failed' });
  }
});

app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

console.log('Launching browser...');
const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  defaultViewport: { width: 1920, height: 1080 },
  args: ['--no-sandbox', '--no-zygote', '--headless', '--disable-gpu'],
});
console.log('Browser ready.');

app.listen(port, () => console.log(`html-to-image listening on port ${port}`));

process.on('SIGINT', async () => { await browser.close(); process.exit(); });
