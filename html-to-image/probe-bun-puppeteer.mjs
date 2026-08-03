// Bun-runtime canary for issue #314 — gates the html-to-image-tests CI job.
// This service still runs on Node in production; this probe is the evidence
// that decides whether the migration to Bun can proceed. It exercises the two
// surfaces in the render path that are genuinely under-verified under Bun:
//   1. the child_process.spawn of Chromium (Puppeteer launches the browser via
//      child_process), and
//   2. the CDP WebSocket transport between puppeteer and Chromium.
// Both are hit by a single launch → newPage → goto(data URL) → evaluate →
// screenshot → close round-trip, lifted almost verbatim from app.js's
// production launch block. Not shipped in the Docker image (not referenced by
// the Dockerfile) and not run by the unit suite (app.test.js imports
// createApp/createBrowserPool through fakes and never launches a browser) —
// this file exists solely for the CI probe.
import puppeteer from 'puppeteer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CHROMIUM_LAUNCH_ARGS } from './app.js';

const browser = await puppeteer.launch({
  defaultViewport: { width: 400, height: 300 },
  args: CHROMIUM_LAUNCH_ARGS,
});

try {
  const page = await browser.newPage();
  await page.goto('data:text/html,<h1 style="color:red">bun+puppeteer probe</h1>');
  const title = await page.evaluate(() => document.querySelector('h1')?.textContent);
  const shot = path.join(os.tmpdir(), `probe-${Date.now()}.png`);
  await page.screenshot({ path: shot, type: 'png' });
  const size = fs.statSync(shot).size;
  fs.unlinkSync(shot);

  if (typeof title !== 'string' || !title.includes('probe')) {
    console.error('FAIL evaluate returned', JSON.stringify(title));
    process.exit(1);
  }
  if (!size || size < 100) {
    console.error('FAIL screenshot size', size);
    process.exit(1);
  }
  console.log(`OK spawn+cdp+screenshot under Bun; evaluate=${JSON.stringify(title)} screenshot=${size}B`);
} finally {
  await browser.close();
}
