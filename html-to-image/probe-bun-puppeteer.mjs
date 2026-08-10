// Bun-runtime canary gating the html-to-image CI job (#314). The unit suite
// drives createApp/createBrowserPool through fakes and never launches a browser,
// so this is the only thing covering the two surfaces the Node→Bun migration put
// at risk: Chromium's child_process.spawn, and the CDP WebSocket transport. One
// launch → newPage → goto → evaluate → screenshot → close hits both.
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
