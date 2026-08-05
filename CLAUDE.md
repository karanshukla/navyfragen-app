# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Does

Navyfragen lets Bluesky users receive anonymous questions and post answers directly to their Bluesky feed. Bluesky (AT Protocol) serves as both the identity provider (OAuth) and a secondary data store (PDS sync).

### Intentional architecture: NF messages are not linked to Bluesky posts

NF messages (stored in the centralised DB) are deliberately kept separate from Bluesky posts. There is no foreign-key or causal link between them at the data layer. This is intentional: NF messages are designed to be ephemeral (centralised storage until ATProto ships private PDS data). Once ATProto supports private data in the PDS, the plan is to drop the centralised NF DB entirely and link NF entities directly to Bluesky records. Any feature that associates an NF message with a Bluesky post must use client-side storage only (localStorage) — never persist that link server-side.

## Monorepo Structure

npm workspaces with three packages:
- `client/` — React + Vite 8 + TypeScript SPA (Mantine UI 9, React Query, React Router)
- `server/` — Bun.serve + Hono + TypeScript API (Kysely ORM, AT Protocol SDK)
- `html-to-image/` — Bun + Puppeteer image renderer (headless Chromium OG-image generation)

**Bun is the package manager** (single root `bun.lock`; installer swapped from npm per issue #250) and **the runtime for every TypeScript/JavaScript service** — the server (dev `bun --watch`, production `Dockerfile.server` on `oven/bun`, CI, and the test suite all run under Bun, #268) and the `html-to-image` renderer (#314, formerly Node + Puppeteer). The client stays on Node for Vite dev/build + Vitest. The server HTTP layer is `Bun.serve` + [Hono](https://hono.dev) (#316): the former Express + cors + cookie-session + express-rate-limit + express-validator stack was migrated to native Hono middleware (hono/cors, hono/cookie signed sessions, hono-rate-limiter, @hono/zod-validator). Business logic (sharp, web-push, pino, node:dns/crypto) runs under Bun natively as before.

Root-level `bun run dev` runs all three workspaces concurrently via `concurrently` (the `html-to-image` image renderer is the third workspace member — Bun runtime + installer since #314, the same single-lockfile story as the server and client).

## Commands

### Root (runs both)
```bash
bun install        # install all workspaces
bun run dev        # start client (port 5173) and server (port 3000) together
```

### Client (`cd client`)
```bash
bun run dev        # Vite dev server
bun run build      # tsc + vite build
bun run lint       # oxlint
bun run test       # Vitest (single run)
bun run test:watch # Vitest watch mode
```

### Server (`cd server`)
```bash
bun run dev        # bun --watch with pino-pretty (Bun runtime)
bun run start      # bun src/index.ts (Bun runtime; no build step)
bun run lint       # oxlint
bun run test       # bun test (Bun runtime; coverage off)
bun run test:watch # bun test --watch
bun run test:coverage # bun test --coverage (config in server/bunfig.toml)
bun run lexgen     # Regenerate AT Protocol lexicon types from ./lexicons/*.json
```

To run a single server test file:
```bash
cd server && bun test --isolate --no-env-file --preload ./src/tests/test-bootstrap.js src/tests/message-service.test.ts
```

## Server Architecture

Two-layer pattern: **route handlers → services**

- `src/hono/*.ts` — Hono route handlers (request/response I/O, session checks, agent initialization) + signed-cookie session middleware + Zod validators. Each domain (auth, message, profile, settings, notification) is a `create<Domain>Hono(ctx)` sub-app mounted in `src/index.ts`.
- `src/services/*.ts` — Business logic, database access, AT Protocol calls

`AppContext` (defined in `src/index.ts`) carries `db`, `logger`, `oauthClient`, `resolver`, and `idResolver` and is passed through the entire stack.

### Authentication Flow

1. Client POSTs handle to `/login` → server initiates AT Protocol OAuth redirect
2. User authenticates on Bluesky → redirected to `/oauth/callback`
3. Server stores OAuth session in DB; sets `c.var.session.did` via the signed-cookie session middleware (`src/hono/session-middleware.ts`)
4. Subsequent authenticated requests restore the AT Protocol `Agent` via `initializeAgentFromHonoSession()` in `src/hono/session-agent-hono.ts` (thin wrapper over `initializeAgentForDid`)

Session is intentionally thin — Bluesky OAuth acts as the authorization proxy. If the Bluesky session expires, the Navyfragen session is also invalidated.

> **Cookie format note (#316):** the session cookie uses Hono's signed-cookie (single `nf-session` cookie, HMAC-SHA256, `name=value.signature`). This is NOT wire-compatible with the former cookie-session/keygrip scheme (dual `navyfragen` + `navyfragen.sig` cookies, SHA1) — the migration invalidated existing sessions, so a one-time re-login was required.

Session is intentionally thin — Bluesky OAuth acts as the authorization proxy. If the Bluesky session expires, the Navyfragen session is also invalidated.

### Database

Kysely ORM. SQLite in development (`:memory:` by default), PostgreSQL in production (when `POSTGRESQL_URL` is set). The SQLite driver is `bun:sqlite` (`src/database/db.ts`), bridged onto Kysely's stock `SqliteDialect` via a small adapter (#263). `better-sqlite3` (the former Node driver) was removed entirely in #288 when the Node code path was retired — the server runs exclusively under Bun. Kysely's `SqliteDialect` is dialect-agnostic; the adapter only bridges two `bun:sqlite` API deltas (no `reader` flag → derived from `columnNames`; variadic params → spread).

Schema and migrations live entirely in `src/database/db.ts`. Add new migrations as numbered keys (`"007"`, etc.) in the `migrations` object — Kysely applies them in order at startup via `migrateToLatest()`.

Key tables: `message` (tid, message, createdAt, recipient DID), `user_profile` (did, createdAt), `user_settings` (did, pdsSyncEnabled, imageTheme), `auth_session`, `auth_state`.

### AT Protocol / Lexicons

Custom lexicon `app.navyfragen.message` defines the record type for messages. Generated TypeScript types live in `src/lexicon/` — do **not** edit these manually; regenerate with `bun run lexgen`. Avoid running `lexgen` on Windows as it can delete generated files; use WSL2.

The `#/` path alias maps to `src/` (configured in `tsconfig.json` `paths`).

### Image Generation

Responding to a message with `includeQuestionAsImage: true` calls the in-house `html-to-image` service (`EXPORT_HTML_URL` env var, defaults to `http://localhost:3033/`). The service lives in `html-to-image/` at the repo root (a Bun workspace member since #314, formerly a standalone Node package). Run it locally with:
```bash
bun run --cwd html-to-image start
```
Or via Docker (the production Dockerfile builds from the repo root so `bun install` can resolve the workspace lockfile):
```bash
docker build -t html-to-image -f docker/Dockerfile.html-to-image .
docker run --rm -p 3033:3033 --shm-size=256m html-to-image
```
Image themes are defined in `src/lib/themes.ts` and stored per-user in `user_settings.imageTheme`. Available themes: `default` (dark gradient card), `compressed` (light minimal), `twitter` (square Twitter/X card).

The image service call uses `fetchWithRetry(url, init, timeoutMs)` (exported from `src/lib/image-generator.ts`) which retries on network errors with exponential backoff until the overall deadline is reached. Each individual request is bounded by an `AbortController`. If retries are exhausted the function throws — image generation failure is **not** silently downgraded to a text-only reply; the whole response attempt fails with the specific error message surfaced to the frontend.

#### Chromium lifecycle (Railway app-sleeping)

The image-gen service runs on Railway with Serverless (app-sleeping) enabled, which sleeps a service after 10 minutes with **no outbound packets**. Chromium must therefore be absent, not merely idle, between renders — a resident browser emits background traffic (component updater, safe-browsing lists, domain reliability, and mDNS/SSDP multicast from MediaRouter/DIAL discovery) that keeps resetting that window, and holds ~500MB RSS while doing nothing.

`createBrowserPool` in `html-to-image/app.js` owns that lifecycle: the browser is launched on the first render, not at boot, and closed after `BROWSER_IDLE_TIMEOUT_MS` (90s, deliberately well under Railway's 10-minute window) or once `RENDERS_BEFORE_RECYCLE` renders have accumulated. `CHROMIUM_LAUNCH_ARGS` disables the background subsystems above so the awake window is quiet too. Two consequences to keep in mind:

- Do not prewarm the browser at startup or on a timer — that reintroduces the exact problem.
- A request arriving after an idle stretch pays a container wake plus a browser launch, which is why `IMAGE_SERVICE_DEADLINE_MS` in `image-generator.ts` is 30s rather than a warm-render budget.
- The Dockerfile runs `tini` as PID 1. Chromium's children are reparented to PID 1 on browser exit and Bun (like Node) does not reap orphans, so without an init the launch/close cycle leaks zombie PIDs until the table is exhausted. Do not drop the `ENTRYPOINT`.

Railway builds this service from `docker/Dockerfile.html-to-image` (root context, same pattern as `Dockerfile.server`/`Dockerfile.client` since #314 folded the service into the root bun workspace — the standalone `html-to-image/Dockerfile` and `package-lock.json` are gone). That is pinned in `railway.html-to-image.json` at the repo root (a root-level config file because the service's Root Directory is `/`, matching `server`/`client`; the service's old `html-to-image/railway.json` is deleted). Previously it relied on Railway's "a Dockerfile always wins" auto-detection while the dashboard/API still reported the `RAILPACK` default, which reads as though the Dockerfile were dead config. See "Railway deploys from Dockerfiles, not native detection" below — this precedent turned out not to be enough on its own.

#### Calling the image service

Both callers — `fetchWithRetry` in `server/src/lib/image-generator.ts` and `HTMLToImageRenderer.Render` in `opengraph-service/internal/shim/renderer.go` — must retry on **wake-shaped HTTP statuses** (408/502/503/504), not just on network errors. A sleeping service answers before it is ready: Railway's edge returns 502 while the container boots, and the service itself returns 503 while Chromium launches. Both are HTTP responses, so treating any response as final turns every wake into a user-visible failure. 4xx and 429 are deliberately *not* retried — a rejected payload fails identically every time, and retrying a limiter that is already shedding only adds load.

Retry budgets are per-attempt, not per-loop: a single hung connection must not consume the whole deadline and starve the retry that would have succeeded.

## Client Architecture

React Query is the data layer. Each domain (auth, messages, profile, settings) has a service file in `src/api/` that exports plain functions and React Query hooks:
- `src/api/apiClient.ts` — thin fetch wrapper; reads `VITE_API_URL` env var (defaults to `""`, so same-origin)
- `src/api/authService.ts` — exports `useSession`, `useLogin`, `useLogout`
- `src/api/messageService.ts`, `profileService.ts`, `settingsService.ts` — similar pattern

All API calls use `credentials: "include"` for cookie forwarding.

### Form Validation

The client uses **Zod v4** (`^4.4.3`). Zod v4 has breaking syntax changes from v3:
- Custom messages on `.min()` / `.max()` use `{ error: "..." }` instead of a plain string
- Validation errors are accessed via `.issues` not `.errors`

### UI Feedback (Toast Notifications)

Transient feedback (success, error) uses Mantine's `showNotification()` from `@mantine/notifications` rather than inline alert state. The `<Notifications>` component is mounted in `src/main.tsx` with `position="bottom-right"` and `autoClose={5000}`. Use `showNotification()` for any new transient messages — don't add stateful alert components to pages.

### Design Tokens

Brand CSS custom properties live in `client/src/index.css` under the `--nf-*` namespace and are the single source of truth for colors and gradients. Key gradient tokens:

- `--nf-grad-mark` — the primary brand gradient (`#3349E0 → #6B3FD4 → #4F1FA6`); use this for all interactive card backgrounds (login, ask, inbox hero, question cards with gradient enabled)
- `--nf-grad-dark` — reserved exclusively for the "default" image-export theme preview in the `ThemeCard` selector; do not use it for new UI elements
- `--nf-grad-hero` — defined but no longer applied to any UI element; do not reintroduce it for text or nav items

Nav active state uses a solid tint (`--nf-nav-active-bg`) — no gradients on nav items. Gradient text (`background-clip: text`) is not used in the app; brand color (`--nf-royal`) is used for highlighted text instead.

### Logging

The server uses Pino (`src/index.ts` → `createLogger()`). In development, stdout is piped through `pino-pretty` via the dev script. In production, when `AXIOM_TOKEN` and `AXIOM_DATASET` are both set, logs are shipped to Axiom via `@axiomhq/pino` as a transport target alongside stdout. Without those vars the logger falls back to stdout only.

Key events that are instrumented:
- OAuth flow: login initiation, callback success/failure, session creation, token consumption, logout
- Anonymous message sent, response posted to Bluesky (with AT URI)
- Account deletion, PDS sync (with counts)
- Settings changes (pdsSyncEnabled, imageTheme)
- All 500-class errors across controllers and services carry structured `{ err, did }` fields

## Code comments

Don't add comments above functions or inline unless the WHY is genuinely non-obvious (a hidden constraint, a subtle invariant, a workaround for a specific bug). Well-named identifiers should make the WHAT self-evident. Before reaching for a comment, check whether the explanation can instead be expressed through abstraction or encapsulation — e.g. business logic embedded in a controller should move to a self-commenting, domain-named method in the service layer rather than being explained in a comment. Favor human-readable, domain-driven names and logical flow over prose explanations, while keeping code legible to agents working in this repo.

## Agent skills live in `.claude/skills/`, not `.agents/skills/`

Claude Code discovers project skills under `.claude/skills/` only. The `skills` CLI (`skills-lock.json`) installs into `.agents/skills/` instead — the cross-agent convention — so anything it writes is inert here and fails silently: no error, no missing-skill warning, just a skill that never appears in the session's skill list. A vendored set of `mantinedev/skills` sat there unused (duplicated at both the repo root and `client/`) until it was removed.

If a skill is genuinely wanted, put it in `.claude/skills/` and add a `!.claude/skills/` exception to `.gitignore` — the `.claude/*` ignore rule otherwise keeps it out of the repo, which reads as "installed" locally while being absent for everyone else. Before vendoring third-party skills, check they target this codebase: the Mantine set documented `@mantine/form` and `Combobox` (neither is used here) and `factory()`/`createVarsResolver` for *authoring* a component library, not consuming one.

## Environment Setup

Copy `server/.env.template` to `server/.env`. Required for production; development defaults are safe for local use. The one required secret with no default is `OAUTH_TOKEN_SECRET` (32-byte hex string for AES-256).

Windows users: use `http://127.0.0.1` instead of `localhost` for cookies to work correctly.

## Testing Conventions

**Server**: Uses `bun:test` (test/describe/hooks/mock/spyOn from `bun:test`) + `node:assert` (which Bun runs natively). The suite runs wholesale under `bun test` (#288 retired the former dual-runtime Node+Bun setup); there is no `node --test` path, no `tsx` loader, and no `c8`. Test setup via `src/tests/test-bootstrap.js` (passed via `--preload`) which sets dummy env vars. Mock the DB with chainable builder objects; mock dependencies with `mock`/`spyOn` from `bun:test` (see "Module Mocking in Server Tests" below).

> **Note on Hono handler tests (#316):** the `src/tests/*-controller.test.ts` files exercise the Hono route handlers via Hono's own `app.request()` (real dispatch through route matching, Zod validation, and response shaping), using an injected-session test helper (`src/tests/helpers/hono-test.ts`) and mock services passed through the `create<Domain>Hono(ctx, deps)` injection seam. The signed-cookie session I/O itself (`src/hono/session-middleware.ts`) is covered by the E2E suite rather than unit tests, so it's excluded from the coverage gate.

**Client**: Uses Vitest + `@testing-library/react` + `happy-dom`. MSW is available for API mocking. Test setup file at `src/tests/setupTests.ts`.

CI runs all tests in a single unified workflow `.github/workflows/Tests.yml`, with separate jobs for client, server, `opengraph-service` (Go), and `html-to-image`. The server job runs under Bun (the runtime the server ships on) and folds the former Bun-runtime canary probes (SQLite data layer, OAuth handle resolution) in ahead of the test suite.

The `html-to-image` job runs under Bun too (#314 — the service migrated from Node). It installs from the single root `bun.lock` (the service is a workspace member) with `PUPPETEER_SKIP_DOWNLOAD=true`, since its unit tests drive `createApp`/`createBrowserPool` through fakes and never launch a browser. A separate Bun-runtime probe step (`html-to-image/probe-bun-puppeteer.mjs`) downloads Chromium explicitly and exercises the real spawn + CDP transport + screenshot round-trip — the load-bearing risk under Bun — gating the job the same way the server's SQLite/OAuth canaries do.

The `html-to-image/` service at the repo root is an Express + Puppeteer image renderer running on Bun. It has its own `app.test.js` (Bun's test runner executes Node's `node:test` API natively, so the suite runs under `bun test` unchanged). Run its tests with:
```bash
cd html-to-image && bun test app.test.js
```

## Testing & Coverage

### Running Coverage

```bash
# Server (from server/)
bun run test:coverage

# Client (from client/)
bun run test -- --coverage
```

The **client** targets 100% across all four v8 metrics (statements, lines, branches, functions) via Vitest's v8 provider.

The **server** targets 97% via Bun's built-in coverage (`coverageThreshold = 0.97` in `server/bunfig.toml`), applied to **lines** — Bun's lcov carries line + function coverage only, with **no branch data** (verified on 1.3.14; documented in `docs/testing-notes.md`). Bun also does **not** honor `/* v8 ignore */` source annotations, so per-file exclusion is done via `coveragePathIgnorePatterns` globs in `bunfig.toml`. These two limitations are the accepted trade-off of moving coverage onto the production runtime (#287); the prior c8/Node path that did honor `v8 ignore` and report branches was retired with the Node test path in #288.

### Coverage Exclusions

**Server** — excluded via `coveragePathIgnorePatterns` in `server/bunfig.toml` (coverage is collected by Bun's built-in reporter):
- `src/lexicon/**` — auto-generated from AT Protocol lexicons
- `src/index.ts` — Hono app + Bun.serve boot + process signal handlers
- `src/lib/assert-fetch-node-patch.ts` — applied via `patchedDependencies`; covers the @atproto-labs fetch-node patch surface
- `src/auth/client.ts`, `src/auth/storage.ts`, `src/auth/session.ts` — AT Protocol OAuth wiring
- `src/auth/e2e-agent-store.ts` — in-memory Map for E2E agents; trivial
- `src/database/db.ts` — Kysely migration runner
- `src/lib/id-resolver.ts` — AT Protocol DID/handle resolver (requires live network)
- `src/lib/env.ts` — bootstrapped before tests run via `test-bootstrap.js`
- `src/hono/session-middleware.ts` — signed-cookie session I/O; covered by the E2E suite (real cookies), not unit tests
- `src/scripts/**` — one-off admin scripts

**Client** — excluded via `coverage.exclude` in `vite.config.ts`:
- `src/tests/**`, `src/main.tsx`, `src/Theme.tsx` — test infra and app entry point
- `src/vite-env.d.ts` — ambient declarations
- `src/styles/tokens.ts` — pure style constant exports
- `src/pushPayload.ts` — a type-only `interface` with no runtime code to execute
- `src/index.css` — a stylesheet; Vite's CSS import handling registers it as a coverage-tracked module with zero instrumentable statements

Adding a new exclusion requires a comment in `docs/testing-notes.md` explaining why and what it would take to test.

### `/* v8 ignore */` Convention

Use `/* v8 ignore next */` (or `/* v8 ignore next N */` for N lines) **only** for:
1. `catch {}` blocks that wrap non-throwing DOM operations (e.g. the AppHeader logout catch block that resets `body.style` — the try never throws in practice)
2. TypeScript-narrowed union branches that are structurally unreachable at runtime

Do **not** use it to skip real business logic. Document any usage in `docs/testing-notes.md`.

**Note on the server:** Bun's coverage reporter does **not** honor `/* v8 ignore */` annotations (verified on 1.3.14), so these markers are inert in server source. Server-side per-file exclusion is done via `coveragePathIgnorePatterns` globs in `bunfig.toml` instead. The `v8 ignore` convention above applies to the **client** (Vitest's v8 provider honors them).

### Module Mocking in Server Tests

The server test suite runs under `bun:test` (#288). Import `test`/`describe`/hooks/`mock`/`spyOn` from `bun:test` and `assert` from `node:assert` (Bun runs `node:assert` natively):

```typescript
import assert from "node:assert";
import { test, describe, beforeAll, afterEach, mock, spyOn } from "bun:test";
```

`mock` is `bun:test`'s mock factory. The API surface (and the differences from the former `node:test`/shim shape worth knowing):
- Create a mock fn: `mock(impl?)` (was `mock.fn(...)`). Its `.mock.calls` is an array of **bare argument arrays** (`calls[0][0]`), not `[{ arguments }]` objects — read args as `m.mock.calls[0][0]`, not `.calls[0].arguments[0]`.
- `mockImplementation`/`mockImplementationOnce`/`mockReturnValue`/`mockReturnValueOnce` live on the function directly (`m.mockImplementation(...)`), **not** under `.mock`.
- Clear call history with `m.mockClear()` (was `m.mock.resetCalls()`); drop implementations with `m.mockReset()`; restore a spy with `m.mockRestore()`. Global cleanup: `mock.clearAllMocks()` (call history) and `mock.restore()` (restore all spies).
- Spy on a method (e.g. `globalThis.fetch`): `spyOn(globalThis, "fetch").mockImplementation(impl)` — `spyOn` takes no implementation arg; chain the impl on. `mock.method(target, name, impl)` from the old shim maps to this.
- `bun:test` uses `beforeAll`/`afterAll` (not `before`/`after`) for the once-per-file hooks.

The default mocking strategy is **dependency injection** (chainable DB builders passed into constructors). `mock.module` is reserved for code that constructs a dependency at module scope with no injection seam — e.g. `auth-service.ts` → `session-agent.ts`'s `new Agent(...)`. The pattern, from `auth-service.test.ts`:

```typescript
let AuthService: typeof import("../services/auth-service").AuthService;
let mockAgent: { getProfile: (...args: any[]) => Promise<any> };

beforeAll(async () => {
  mockAgent = { getProfile: mock(async () => ({ data: undefined })) };
  // Spread the real module so every export it has keeps working and only
  // initializeAgentForDid is swapped (see the note on --isolate below).
  const realSessionAgent = await import("../auth/session-agent");
  mock.module("../auth/session-agent", () => ({
    ...realSessionAgent,
    initializeAgentForDid: async (ctx, did) => { /* ... */ return mockAgent; },
  }));
  // Register the mock BEFORE importing the module under test so its
  // transitive import of session-agent picks up the fakes.
  const mod = await import("../services/auth-service");
  AuthService = mod.AuthService;
});
```

Notes:
- `mock.module` must run **before** the SUT is imported — so the SUT is loaded via a dynamic `import()` in `beforeAll()`, never a top-level static import. Bun's `mock.module` takes a factory `() => exports` (the opposite of node:test's `{ exports }` shape) and is synchronous (returns `void`).
- Mock the **nearest seam** to the SUT, not the deepest leaf. `auth-service.ts` imports `initializeAgentForDid` from `../auth/session-agent`; mocking that module (not `@atproto/api` directly) avoids having to re-export every other `@atproto/api` symbol (`RichText`, `AtpAgent`, …) that other transitively-imported modules use.
- **`mock.module` is process-global and not restorable.** `mock.restore()`/`clearAllMocks()` clear mock call history and restore spies but do **not** unmock modules, so a partial mock registered in one file leaks into every other file that imports the real module. The `test`/`test:coverage` scripts pass `--isolate` for a fresh per-file module registry. Do not let `--isolate` be the only thing keeping a mock contained: **spread the real module into the mock** (`() => ({ ...realModule, theOneYouAreFaking })`) so a partial mock can't take out files that import the real exports with a missing-export `SyntaxError`.
- The mock should faithfully reproduce the real module's branching (e.g. return the e2e agent when present, `null` on restore-miss) so existing tests that rely on the real behavior keep passing.

#### Bun-runtime specifics (#269, #270, #288)

- `bun run test` / `test:coverage` add `--no-env-file` (Bun otherwise auto-loads `server/.env`'s real VAPID keys, which the dummy-env test bootstrap can't override) and `--isolate` (per-file module isolation). Bun **1.3.14+** is required (the floor `@types/bun` is pinned to).
- The `undici_v8` module-load crash (8.x `CacheStorage` ctor throws `webidl.util.markAsUncloneable is not a function` under Bun) and the `unicastFetchWrap` SSRF guard (which requires `process.versions.undici`, absent under Bun) are resolved by a **patched `@atproto-labs/fetch-node`** — see `patches/@atproto-labs%2Ffetch-node@0.3.5.patch` (applied via `patchedDependencies` in the root `package.json`). The patch lazy-imports `undici_v8` (so it never loads under Bun) and gives `unicastFetchWrap` a Bun branch. **That branch still enforces the unicast rules**: it runs the package's own `unicastLookup` before the request, so a handle resolving to a loopback/private/link-local address is rejected exactly as on Node. Do not reduce it to the literal-IP check — `isUnicastIpHostname` returns `undefined` for a DNS name, so on its own it lets `http://internal.example.com/` straight through, and handle resolution fetches user-supplied hostnames. The branch also rejects non-HTTP(S) schemes, which the Node path got for free from undici: every unicast check keys on `url.hostname`, which is `""` for `file:`, and Bun's `fetch` reads `file:` URLs where Node's refuses them. The one gap versus the old Node path: the check runs before the connection rather than on the socket, so DNS rebinding between check and connect is not caught.
- **Never call `dns.setServers()` unconditionally.** Under Node it only rebinds the `dns.resolve*` family and leaves `dns.lookup` on getaddrinfo; under Bun it steers `dns.lookup` too, so the process forgets every name the system resolver owns — container DNS included. `src/index.ts` keeps its Windows TXT-lookup workaround gated behind `process.platform === "win32"` for that reason.
- **The listen address is negotiated, not hardcoded** (`listenPreferringDualStack` in `src/index.ts`). A wildcard `HOST` (`"::"` or `"0.0.0.0"`) binds `"::"` so a single dual-stack listener serves both families — required in production, where Caddy reaches this service only over Railway's private network and that network is IPv6-only (`BACKEND_DOMAIN = ${{Backend.RAILWAY_PRIVATE_DOMAIN}}`). Where the network has no IPv6 at all — every Docker bridge network in CI and local compose — the bind falls back to `"0.0.0.0"`; Bun surfaces that case as a spurious `EADDRINUSE` (`errno: 0`) instead of degrading the way Node does. A non-wildcard `HOST` is bound verbatim, so `HOST=127.0.0.1` still means loopback. **In production a non-wildcard `HOST` is refused at boot** (`assertProductionBindHost` in `src/lib/assert-production-bind-host.ts`, called first in `Server.create()`) — a loopback bind boots "healthy" but is unreachable from Caddy, with no error signal in the server's own logs, which caused a full outage on both Railway server services on 2026-07-25 (#298). The guard is a no-op outside `NODE_ENV=production`, so local loopback testing and the test suite are unaffected. See "Production server services must bind a wildcard HOST" below.
- **The OAuth login path has its own CI probe** (`Probe SQLite data layer + OAuth handle resolution under Bun` in `Tests.yml`). E2E signs in through `/auth/e2e-login` with an app password and never resolves a handle, so without this the one production surface that runs through the patched `fetch-node` would be untested. Its Bun failure mode is silent — bluesky-social/atproto#3511 has resolution returning `undefined`, surfacing only as "does not resolve to a DID" — so the probe asserts a `did:` string comes back rather than trusting the call not to throw. The SQLite probe (`createDb` → `migrateToLatest` → insert/select through the `bun:sqlite` adapter) gates the data layer the test suite mocks around.
- Coverage comes from Bun's built-in reporter (`bun test --coverage`, configured in `server/bunfig.toml`). It does **not** honor `/* v8 ignore */` and its lcov carries line + function coverage only (no branch data) — see "Coverage under Bun" in `docs/testing-notes.md` for the rationale and accepted trade-offs.

## Deployment (Railway)

### Railway deploys from Dockerfiles, not native detection

Every buildable service (`server`, `client`, `caddy`, `anubis`, `opengraph-service`, `html-to-image`, `anubis/prometheus`) has a committed `railway.json` (or, for the three repo-root-context services, `railway.server.json` / `railway.client.json` / `railway.html-to-image.json`) pinning `"builder": "DOCKERFILE"` and the Dockerfile path, following the `html-to-image/railway.json` precedent. This exists because a native RAILPACK build on the `server` service **already crashed production once**: `patchedDependencies` (which applies the Bun `undici_v8` fix in `patches/@atproto-labs%2Ffetch-node@0.3.5.patch`) is a Bun-only `package.json` field, so an `npm install`-based native build silently ignores it and the server throws `webidl.util.markAsUncloneable is not a function` on boot. CI is not a safety net for this class of failure — `DockerSmoke.yml` builds `docker/Dockerfile.server` directly and was green throughout the incident; it proves the Dockerfile works, not which builder Railway actually used.

`server`, `client`, and `html-to-image` build with `context: ..` (repo root) per `docker/docker-compose.yml` — `Dockerfile.server`/`Dockerfile.client`/`Dockerfile.html-to-image` copy the root `package.json`/`bun.lock`/`patches/` before the per-workspace source. Their Railway services must therefore have **Root Directory `/`** with a `railwayConfigFile` pointing at `railway.server.json` / `railway.client.json` / `railway.html-to-image.json` respectively (a service-level dashboard setting — the files can't share the ambient `railway.json` name at repo root). `caddy`, `anubis`, and `opengraph-service` are self-contained (`COPY Caddyfile ./`, etc.) and keep Root Directory at their own subdirectory.

Committing the config file alone does not switch the builder — Railway only reads it once a service's "Config-as-code path" is set in the dashboard (or via the Railway MCP `update-service` tool's `railwayConfigFile`/`rootDirectory`/`dockerfilePath` params). Do not assume a checked-in `railway.json` is active; confirm with `get-service-config` (via the Railway MCP or dashboard) that `build.builder` reads `DOCKERFILE`, not `RAILPACK`/`NIXPACKS`, before relying on it.

### Production server services must bind a wildcard HOST

Every production server service (`Navyfragen Server NA`, `Navyfragen Server EU`) must have `HOST` set to a wildcard — `::` (preferred, dual-stack) or `0.0.0.0`. Caddy reaches the server only over Railway's private IPv6-only network (`BACKEND_DOMAIN = ${{Backend.RAILWAY_PRIVATE_DOMAIN}}`), so anything else is unreachable: a loopback bind (`localhost`, `127.0.0.1`) boots "healthy" and logs `Server (production) running on port http://localhost:8080`, with the only failure signal — `connection refused` — surfacing in *Caddy's* logs, not the server's. Both server services shipped with `HOST=localhost` and were silently unreachable until 2026-07-25 (#298).

This is now enforced at boot: `assertProductionBindHost()` in `src/lib/assert-production-bind-host.ts` runs first in `Server.create()` and throws on a non-wildcard `HOST` when `NODE_ENV=production`. A restart loop on Railway is strictly more debuggable than an invisible outage. The guard is a no-op outside production, so local loopback testing (`HOST=127.0.0.1`) and the test suite (`NODE_ENV=test`, `HOST=localhost`) are unaffected.

Operational notes:

- `HOST` should be a **shared/environment-level variable** on Railway, not a per-service variable, so it cannot drift between NA and EU independently — the incident had both misconfigured because each had been set separately.
- The ad-hoc `HOST=::` fix applied via the Railway API on 2026-07-25 is the *only* thing currently holding production reachable. Recreating either service, adding a new environment, or "fixing" `HOST` to a plausible-looking value like `127.0.0.1` would reintroduce the outage — now with a loud boot failure rather than a silent one.
- Confirm with `get-service-config` (Railway MCP or dashboard) that `HOST` reads `::` (or `0.0.0.0`) on every server service before relying on it; do not assume a dashboard value matches what the running container received.

### Anubis challenge state must outlive a single process

Anubis holds two pieces of state that a user's in-flight challenge depends on: the ed25519 key its cookies are signed with, and the issued-challenge records themselves. Both default to being process-local, and both defaults are wrong here.

- **`ED25519_PRIVATE_KEY_HEX` is a required env var on the Anubis service**, not an optional one. Left unset, Anubis calls `ed25519.GenerateKey(rand.Reader)` at boot and logs `generating random key, Anubis will have strange behavior when multiple instances are behind the same load balancer target`. Every restart then mints a new key and silently invalidates every outstanding cookie, so `COOKIE_EXPIRATION_TIME=168h` promises a week of validity the deployment cannot honor. Symptom: users are re-challenged at random and "clearing cookies fixes it" — see issue #306.
- **`store` in `botPolicy.json` points at Valkey, not the default `memory` backend**, whose own docs say "do not use this persistently in production". The Caddyfile reaches Anubis through `dynamic a` DNS with `refresh 1s` and `lb_policy round_robin`, which deliberately treats every DNS result as a separate upstream. Steady state is one replica, but a Railway deploy overlaps the old and new instances, and with a memory store those two have disjoint challenge tables.

Anubis cannot read the store URL from an environment variable (upstream TecharoHQ/anubis#1152), so it is a literal in the committed policy file. That is why the Valkey service runs **without a password** — a credential in this file would be a credential in a public repo. It is reachable only over Railway's project-scoped private network, and the only thing in it is challenge state with a 30-minute TTL. Do not "harden" it by adding auth without first solving the interpolation problem, or the URL in `botPolicy.json` stops matching and Anubis fails to reach its store.

The Valkey service must be up before Anubis boots, and must bind `::` — Railway's private network is IPv6-only. "Before" is literal: `valkey.Factory` dials and PINGs the store while *parsing the policy file*, so an unreachable Valkey is `can't parse policy file: valkey.Factory: ping failed` and a crash loop, not a degraded mode that recovers when the store appears. `docker/docker-compose.yml` encodes this as `condition: service_healthy`, and gives its Valkey the network alias `valkey.railway.internal` so the one committed URL literal resolves in both environments.
