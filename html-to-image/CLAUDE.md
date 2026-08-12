# html-to-image (`html-to-image/`)

Express + Puppeteer image renderer running on Bun, a root workspace member installing
from the single root `bun.lock`.

## Chromium lifecycle (Railway app-sleeping)

Railway sleeps this service after 10 minutes with **no outbound packets**, so
Chromium must be absent, not merely idle, between renders: a resident browser emits
background traffic (component updater, safe-browsing lists, domain reliability, mDNS/
SSDP multicast from MediaRouter/DIAL discovery) that keeps resetting that window, and
holds ~500MB RSS doing nothing.

`createBrowserPool` in `app.js` owns this: the browser launches on the first render,
not at boot, and closes after `BROWSER_IDLE_TIMEOUT_MS` (90s, well under the 10-minute
window) or `RENDERS_BEFORE_RECYCLE` renders. `CHROMIUM_LAUNCH_ARGS` disables the
subsystems above so the awake window is quiet too.

- **Never prewarm at startup or on a timer.** The one exception is demand-driven:
  `POST /warm` launches Chromium ahead of a render the caller knows is coming, called
  via `POST /messages/warm-image` when a user opens a reply composer with the
  question-as-image preference on. It stays sleep-safe because `pool.warm()` arms the
  idle close itself — nothing calls `onRenderComplete` after a warm, so without that
  an abandoned composer would pin Chromium up forever. Any new warm trigger must be a
  real user-intent signal, never a schedule.
- A request after an idle stretch pays a container wake plus a browser launch, which
  is why `IMAGE_SERVICE_DEADLINE_MS` in `image-generator.ts` is 30s. The composer warm
  shrinks that in the common case but cannot remove it, so the deadline stays.
- **Do not drop the `ENTRYPOINT`.** `tini` runs as PID 1 because Chromium's children
  are reparented to PID 1 on browser exit and Bun does not reap orphans — without an
  init, the launch/close cycle leaks zombie PIDs until the table is exhausted.

Railway builds this from `docker/Dockerfile.html-to-image` (root context, like
`Dockerfile.server`/`Dockerfile.client`), pinned in `railway/html-to-image.json` —
see `.claude/skills/railway-deployment/SKILL.md`.

## Running it

```bash
bun run --cwd html-to-image start

# or via Docker (built from the repo root so bun install resolves the workspace lockfile)
docker build -t html-to-image -f docker/Dockerfile.html-to-image .
docker run --rm -p 3033:3033 --shm-size=256m html-to-image
```

## Tests

Bun runs Node's `node:test` API natively, so `app.test.js` runs unchanged:

```bash
cd html-to-image && bun test app.test.js
```

Unit tests drive `createApp`/`createBrowserPool` through fakes and never launch a
browser (CI installs with `PUPPETEER_SKIP_DOWNLOAD=true`); the real spawn + CDP +
screenshot round-trip is covered by the `probe-bun-puppeteer.mjs` CI step.
