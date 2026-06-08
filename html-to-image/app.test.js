import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import { createApp } from './app.js';

// Starts the app on a random port and returns { server, url }.
function startServer(getBrowser) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(createApp(getBrowser));
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
    server.on('error', reject);
  });
}

function stopServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

// Mock browser whose page writes dummy bytes so createReadStream succeeds.
function makeMockBrowser({ failScreenshot = false } = {}) {
  const calls = { setViewport: [], goto: [], screenshot: [], pdf: [] };
  const page = {
    setViewport: async (opts) => { calls.setViewport.push(opts); },
    goto:        async (url)  => { calls.goto.push(url); },
    screenshot:  async (args) => {
      calls.screenshot.push({ ...args });
      if (failScreenshot) throw new Error('screenshot failed');
      if (args.path) await fs.writeFile(args.path, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    },
    pdf: async (args) => {
      calls.pdf.push({ ...args });
      if (args.path) await fs.writeFile(args.path, Buffer.from('%PDF-1.4'));
    },
    close: async () => {},
  };
  const browser = { newPage: async () => page, connected: true };
  return { browser, calls };
}

async function post(url, body, extraHeaders = {}) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
describe('GET /', () => {
  let server, url;
  before(async () => ({ server, url } = await startServer(async () => { throw new Error('no browser'); })));
  after(() => stopServer(server));

  test('returns 200 with status ok', async () => {
    const res = await fetch(url);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  });
});

// ---------------------------------------------------------------------------
// Validation middleware
// ---------------------------------------------------------------------------
describe('POST / validation', () => {
  let server, url;
  before(async () => ({ server, url } = await startServer(async () => { throw new Error('no browser'); })));
  after(() => stopServer(server));

  test('rejects non-POST methods with 405', async () => {
    const res = await fetch(`${url}/`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 405);
  });

  test('rejects wrong Content-Type with 415', async () => {
    const res = await fetch(`${url}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'hello',
    });
    assert.equal(res.status, 415);
  });

  test('rejects missing source with 400', async () => {
    const res = await post(url, { format: 'png' });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /source/);
  });

  test('rejects non-string source with 400', async () => {
    const res = await post(url, { source: 42, format: 'png' });
    assert.equal(res.status, 400);
  });

  test('rejects empty source with 400', async () => {
    const res = await post(url, { source: '', format: 'png' });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /empty/);
  });

  test('rejects missing format with 400', async () => {
    const res = await post(url, { source: '<h1>hi</h1>' });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /format/);
  });

  test('rejects unknown format with 400', async () => {
    const res = await post(url, { source: '<h1>hi</h1>', format: 'bmp' });
    assert.equal(res.status, 400);
  });

  test('rejects array options with 400', async () => {
    const res = await post(url, { source: '<h1>hi</h1>', format: 'png', options: ['bad'] });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /options/);
  });

  test('rejects string options with 400', async () => {
    const res = await post(url, { source: '<h1>hi</h1>', format: 'png', options: 'bad' });
    assert.equal(res.status, 400);
  });
});

// ---------------------------------------------------------------------------
// Browser unavailable
// ---------------------------------------------------------------------------
describe('POST / browser unavailable', () => {
  let server, url;
  before(async () => ({ server, url } = await startServer(async () => { throw new Error('crashed'); })));
  after(() => stopServer(server));

  test('returns 503 when getBrowser throws', async () => {
    const res = await post(url, { source: '<h1>hi</h1>', format: 'png' });
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.match(body.error, /Browser unavailable/);
  });
});

// ---------------------------------------------------------------------------
// Screenshot — HTML source
// ---------------------------------------------------------------------------
describe('POST / HTML source', () => {
  let server, url, calls;

  before(async () => {
    const { browser, calls: c } = makeMockBrowser();
    calls = c;
    ({ server, url } = await startServer(async () => browser));
  });
  after(() => stopServer(server));

  test('returns 200 with image/png content-type', async () => {
    const res = await post(url, { source: '<h1>Hello</h1>', format: 'png' });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /image\/png/);
  });

  test('always calls goto with file:// (never navigates to external URLs)', () => {
    assert.match(calls.goto[0], /^file:\/\//);
  });

  test('uses default viewport 1920x1080 when options omitted', () => {
    assert.deepEqual(calls.setViewport[0], { width: 1920, height: 1080 });
  });

  test('passes type:png to page.screenshot', () => {
    assert.equal(calls.screenshot[0].type, 'png');
    assert.ok(calls.screenshot[0].path);
  });

  test('URL string passed as source is treated as HTML, not navigated to', async () => {
    const { browser, calls: c } = makeMockBrowser();
    const { server: s, url: u } = await startServer(async () => browser);
    try {
      await post(u, { source: 'https://evil.com', format: 'png' });
      assert.match(c.goto[0], /^file:\/\//);
    } finally {
      await stopServer(s);
    }
  });
});

// ---------------------------------------------------------------------------
// options.width / options.height
// ---------------------------------------------------------------------------
describe('POST / custom viewport', () => {
  let server, url, calls;

  before(async () => {
    const { browser, calls: c } = makeMockBrowser();
    calls = c;
    ({ server, url } = await startServer(async () => browser));
  });
  after(() => stopServer(server));

  test('uses options.width and options.height for viewport', async () => {
    await post(url, { source: '<h1>hi</h1>', format: 'png', options: { width: 800, height: 600 } });
    assert.deepEqual(calls.setViewport[0], { width: 800, height: 600 });
  });
});

// ---------------------------------------------------------------------------
// options.args passthrough
// ---------------------------------------------------------------------------
describe('POST / options.args passthrough', () => {
  let server, url, calls;

  before(async () => {
    const { browser, calls: c } = makeMockBrowser();
    calls = c;
    ({ server, url } = await startServer(async () => browser));
  });
  after(() => stopServer(server));

  test('merges options.args into screenshot call', async () => {
    await post(url, {
      source: '<h1>hi</h1>',
      format: 'png',
      options: { args: { fullPage: true } },
    });
    assert.equal(calls.screenshot[0].fullPage, true);
    assert.equal(calls.screenshot[0].type, 'png');
  });

  test('format.args overrides options.args for conflicting keys', async () => {
    await post(url, {
      source: '<h1>hi</h1>',
      format: 'png',
      options: { args: { type: 'jpeg' } },
    });
    assert.equal(calls.screenshot[1].type, 'png');
  });
});

// ---------------------------------------------------------------------------
// PDF format
// ---------------------------------------------------------------------------
describe('POST / pdf format', () => {
  let server, url, calls;

  before(async () => {
    const { browser, calls: c } = makeMockBrowser();
    calls = c;
    ({ server, url } = await startServer(async () => browser));
  });
  after(() => stopServer(server));

  test('returns 200 with application/pdf content-type', async () => {
    const res = await post(url, { source: '<h1>hi</h1>', format: 'pdf' });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/pdf/);
  });

  test('calls page.pdf with format:A4 and a path', () => {
    assert.equal(calls.pdf[0]['format'], 'A4');
    assert.ok(calls.pdf[0].path);
  });

  test('merges options.args into pdf call', async () => {
    await post(url, {
      source: '<h1>hi</h1>',
      format: 'pdf',
      options: { args: { landscape: true } },
    });
    assert.equal(calls.pdf[1].landscape, true);
  });
});

// ---------------------------------------------------------------------------
// jpg and webp formats
// ---------------------------------------------------------------------------
describe('POST / jpg and webp formats', () => {
  let server, url, calls;

  before(async () => {
    const { browser, calls: c } = makeMockBrowser();
    calls = c;
    ({ server, url } = await startServer(async () => browser));
  });
  after(() => stopServer(server));

  test('jpg returns image/jpeg and type:jpeg to Puppeteer', async () => {
    const res = await post(url, { source: '<h1>hi</h1>', format: 'jpg' });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /image\/jpeg/);
    assert.equal(calls.screenshot[0].type, 'jpeg');
  });

  test('jpeg alias returns image/jpeg', async () => {
    const res = await post(url, { source: '<h1>hi</h1>', format: 'jpeg' });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /image\/jpeg/);
  });

  test('webp returns image/webp and type:webp to Puppeteer', async () => {
    const res = await post(url, { source: '<h1>hi</h1>', format: 'webp' });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /image\/webp/);
    assert.equal(calls.screenshot[calls.screenshot.length - 1].type, 'webp');
  });
});

// ---------------------------------------------------------------------------
// Screenshot failure
// ---------------------------------------------------------------------------
describe('POST / screenshot failure', () => {
  let server, url;

  before(async () => {
    const { browser } = makeMockBrowser({ failScreenshot: true });
    ({ server, url } = await startServer(async () => browser));
  });
  after(() => stopServer(server));

  test('returns 500 when screenshot throws', async () => {
    const res = await post(url, { source: '<h1>hi</h1>', format: 'png' });
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.match(body.error, /screenshot failed/);
  });
});
