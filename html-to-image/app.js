import puppeteer from 'puppeteer';
import express from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import tmp from 'tmp';

const app = express();
const port = 3033;

app.use(express.json({ limit: '1mb' }));

app.use(rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use((req, res, next) => {
  if (req.method !== 'POST') {
    return next({ status: 405, message: 'Method not allowed' });
  }
  if (req.get('Content-Type') !== 'application/json') {
    return next({ status: 415, message: "Only 'application/json' is supported" });
  }
  if (typeof req.body.source !== 'string' || req.body.source === '') {
    return next({ status: 400, message: "'source' must be a non-empty HTML string" });
  }
  if (req.body.format !== 'png') {
    return next({ status: 400, message: "'format' must be 'png'" });
  }
  if (req.body.options !== undefined && typeof req.body.options !== 'object') {
    return next({ status: 400, message: "'options' must be an object if provided" });
  }
  next();
});

app.post('/', async (req, res) => {
  const options = req.body.options || {};
  const tmpinput = tmp.fileSync({ prefix: 'htmltoimage-', postfix: '.html' });
  const tmpoutput = tmp.fileSync({ prefix: 'htmltoimage-' });

  try {
    await fs.promises.writeFile(tmpinput.name, req.body.source);

    const page = await browser.newPage();
    try {
      await page.setViewport({
        width: options.width || 1920,
        height: options.height || 1080,
      });
      await page.goto('file://' + tmpinput.name);
      await page.screenshot({ type: 'png', path: tmpoutput.name });
    } finally {
      await page.close();
    }

    res.header('Content-Type', 'image/png');
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

app.use((err, req, res, _next) => {
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

console.log('Launching browser...');
const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  defaultViewport: { width: 1920, height: 1080 },
  args: ['--no-sandbox', '--no-zygote', '--headless', '--disable-gpu'],
});
console.log('Browser ready.');

app.listen(port, () => {
  console.log(`html-to-image listening on port ${port}`);
});

process.on('SIGINT', async () => {
  await browser.close();
  process.exit();
});
