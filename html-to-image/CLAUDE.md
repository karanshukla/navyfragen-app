# html-to-image (`html-to-image/`)

Express + Puppeteer image renderer running on Bun (#314 migrated it from Node; it is a root workspace member, so it installs from the single root `bun.lock`).

## Chromium lifecycle (Railway app-sleeping)

The image-gen service runs on Railway with Serverless (app-sleeping) enabled, which sleeps a service after 10 minutes with **no outbound packets**. Chromium must therefore be absent, not merely idle, between renders — a resident browser emits background traffic (component updater, safe-browsing lists, domain reliability, and mDNS/SSDP multicast from MediaRouter/DIAL discovery) that keeps resetting that window, and holds ~500MB RSS while doing nothing.

`createBrowserPool` in `html-to-image/app.js` owns that lifecycle: the browser is launched on the first render, not at boot, and closed after `BROWSER_IDLE_TIMEOUT_MS` (90s, deliberately well under Railway's 10-minute window) or once `RENDERS_BEFORE_RECYCLE` renders have accumulated. `CHROMIUM_LAUNCH_ARGS` disables the background subsystems above so the awake window is quiet too. Two consequences to keep in mind:

- Do not prewarm the browser at startup or on a timer — that reintroduces the exact problem. **Demand-driven warming is the one exception**: `POST /warm` on the image service launches Chromium ahead of a render the caller knows is coming, and the client calls it (via `POST /messages/warm-image`) when a user opens a reply composer with the question-as-image preference on. It stays sleep-safe because `pool.warm()` arms the idle close itself — nothing calls `onRenderComplete` after a warm, so without that a composer opened and abandoned would pin Chromium up forever. If you add another warm trigger, it must be a real user-intent signal, never a schedule.
- A request arriving after an idle stretch pays a container wake plus a browser launch, which is why `IMAGE_SERVICE_DEADLINE_MS` in `image-generator.ts` is 30s rather than a warm-render budget. The composer warm shrinks that in the common case but cannot remove it, so the deadline stays.
- The Dockerfile runs `tini` as PID 1. Chromium's children are reparented to PID 1 on browser exit and Bun (like Node) does not reap orphans, so without an init the launch/close cycle leaks zombie PIDs until the table is exhausted. Do not drop the `ENTRYPOINT`.

Railway builds this service from `docker/Dockerfile.html-to-image` (root context, same pattern as `Dockerfile.server`/`Dockerfile.client` since #314 folded the service into the root bun workspace — the standalone `html-to-image/Dockerfile` and `package-lock.json` are gone). That is pinned in `railway/html-to-image.json` (a repo-root-context config because the service's Root Directory is `/`, matching `server`/`client`; the service's old `html-to-image/railway.json` is deleted). Previously it relied on Railway's "a Dockerfile always wins" auto-detection while the dashboard/API still reported the `RAILPACK` default, which reads as though the Dockerfile were dead config. See `.claude/skills/railway-deployment/SKILL.md` — this precedent turned out not to be enough on its own.

## Running it

```bash
bun run --cwd html-to-image start
```

Or via Docker (the production Dockerfile builds from the repo root so `bun install` can resolve the workspace lockfile):

```bash
docker build -t html-to-image -f docker/Dockerfile.html-to-image .
docker run --rm -p 3033:3033 --shm-size=256m html-to-image
```

## Tests

Bun's test runner executes Node's `node:test` API natively, so `app.test.js` runs under `bun test` unchanged:

```bash
cd html-to-image && bun test app.test.js
```

The unit tests drive `createApp`/`createBrowserPool` through fakes and never launch a browser, which is why CI installs with `PUPPETEER_SKIP_DOWNLOAD=true`. The real spawn + CDP transport + screenshot round-trip (the load-bearing risk under Bun) is covered by a separate probe step, `html-to-image/probe-bun-puppeteer.mjs`, which downloads Chromium explicitly and gates the job the same way the server's SQLite/OAuth canaries do.
