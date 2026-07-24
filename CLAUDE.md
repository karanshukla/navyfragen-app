# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Does

Navyfragen lets Bluesky users receive anonymous questions and post answers directly to their Bluesky feed. Bluesky (AT Protocol) serves as both the identity provider (OAuth) and a secondary data store (PDS sync).

### Intentional architecture: NF messages are not linked to Bluesky posts

NF messages (stored in the centralised DB) are deliberately kept separate from Bluesky posts. There is no foreign-key or causal link between them at the data layer. This is intentional: NF messages are designed to be ephemeral (centralised storage until ATProto ships private PDS data). Once ATProto supports private data in the PDS, the plan is to drop the centralised NF DB entirely and link NF entities directly to Bluesky records. Any feature that associates an NF message with a Bluesky post must use client-side storage only (localStorage) — never persist that link server-side.

## Monorepo Structure

npm workspaces with two packages:
- `client/` — React + Vite 7 + TypeScript SPA (Mantine UI 8, React Query, React Router)
- `server/` — Express + TypeScript API (Kysely ORM, AT Protocol SDK)

**Bun is the package manager** (single root `bun.lock`; installer swapped from npm per issue #250) and **the server runtime** — dev (`bun --watch`), production (`Dockerfile.server` on `oven/bun`, source-first), and CI all run the server under Bun (#268). The client stays on Node (Vite dev/build, Vitest). The server test suite is dual-runtime: `bun run test` (Node, the coverage/Coveralls baseline) and `bun run test:bun` (Bun, a blocking CI gate, #269). The server's Node APIs (Express, sharp, web-push, pino, node:dns/crypto) are kept as-is — they run under Bun natively; no Bun-native API rewrite.

Root-level `bun run dev` runs both workspaces concurrently via `concurrently` (the html-to-image image renderer is also started this way but remains a standalone npm package outside the workspace).

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
bun run test       # Node.js built-in test runner (single run) — the coverage/Coveralls baseline
bun run test:watch # Node.js built-in test runner watch mode
bun run test:bun   # bun test (Bun runtime; dual-runtime, see #269)
bun run lexgen     # Regenerate AT Protocol lexicon types from ./lexicons/*.json
```

To run a single server test file:
```bash
cd server && node --import ./src/tests/test-bootstrap.js --import tsx --test src/tests/message-service.test.ts
```

## Server Architecture

Three-layer pattern: **routes → controllers → services**

- `src/routes/*.ts` — Express Router setup, validation middleware wiring
- `src/controllers/*.ts` — Request/response handling, session checks, agent initialization
- `src/services/*.ts` — Business logic, database access, AT Protocol calls

`AppContext` (defined in `src/index.ts`) carries `db`, `logger`, `oauthClient`, and `resolver` and is passed through the entire stack.

### Authentication Flow

1. Client POSTs handle to `/login` → server initiates AT Protocol OAuth redirect
2. User authenticates on Bluesky → redirected to `/oauth/callback`
3. Server stores OAuth session in DB; sets `req.session.did` (cookie-session)
4. Subsequent authenticated requests restore the AT Protocol `Agent` via `initializeAgentFromSession()` in `src/auth/session-agent.ts`

Session is intentionally thin — Bluesky OAuth acts as the authorization proxy. If the Bluesky session expires, the Navyfragen session is also invalidated.

### Database

Kysely ORM. SQLite in development (`:memory:` by default), PostgreSQL in production (when `POSTGRESQL_URL` is set). The dev SQLite driver is runtime-gated (`src/database/db.ts`): `better-sqlite3` under Node, `bun:sqlite` behind a small adapter under Bun (so the server can run under the Bun runtime — see #263). Kysely's `SqliteDialect` is dialect-agnostic; the adapter only bridges two `bun:sqlite` API deltas (no `reader` flag → derived from `columnNames`; variadic params → spread).

Schema and migrations live entirely in `src/database/db.ts`. Add new migrations as numbered keys (`"007"`, etc.) in the `migrations` object — Kysely applies them in order at startup via `migrateToLatest()`.

Key tables: `message` (tid, message, createdAt, recipient DID), `user_profile` (did, createdAt), `user_settings` (did, pdsSyncEnabled, imageTheme), `auth_session`, `auth_state`.

### AT Protocol / Lexicons

Custom lexicon `app.navyfragen.message` defines the record type for messages. Generated TypeScript types live in `src/lexicon/` — do **not** edit these manually; regenerate with `bun run lexgen`. Avoid running `lexgen` on Windows as it can delete generated files; use WSL2.

The `#/` path alias maps to `src/` (configured in `tsconfig.json` `paths`).

### Image Generation

Responding to a message with `includeQuestionAsImage: true` calls the in-house `html-to-image` service (`EXPORT_HTML_URL` env var, defaults to `http://localhost:3033/`). The service lives in `html-to-image/` at the repo root. Run it locally with:
```bash
docker build -t html-to-image ./html-to-image
docker run --rm -p 3033:3033 html-to-image
```
Image themes are defined in `src/lib/themes.ts` and stored per-user in `user_settings.imageTheme`. Available themes: `default` (dark gradient card), `compressed` (light minimal), `twitter` (square Twitter/X card).

The image service call uses `fetchWithRetry(url, init, timeoutMs)` (exported from `src/lib/image-generator.ts`) which retries on network errors with exponential backoff until the overall deadline is reached. Each individual request is bounded by an `AbortController`. If retries are exhausted the function throws — image generation failure is **not** silently downgraded to a text-only reply; the whole response attempt fails with the specific error message surfaced to the frontend.

#### Chromium lifecycle (Railway app-sleeping)

The image-gen service runs on Railway with Serverless (app-sleeping) enabled, which sleeps a service after 10 minutes with **no outbound packets**. Chromium must therefore be absent, not merely idle, between renders — a resident browser emits background traffic (component updater, safe-browsing lists, domain reliability, and mDNS/SSDP multicast from MediaRouter/DIAL discovery) that keeps resetting that window, and holds ~500MB RSS while doing nothing.

`createBrowserPool` in `html-to-image/app.js` owns that lifecycle: the browser is launched on the first render, not at boot, and closed after `BROWSER_IDLE_TIMEOUT_MS` (90s, deliberately well under Railway's 10-minute window) or once `RENDERS_BEFORE_RECYCLE` renders have accumulated. `CHROMIUM_LAUNCH_ARGS` disables the background subsystems above so the awake window is quiet too. Two consequences to keep in mind:

- Do not prewarm the browser at startup or on a timer — that reintroduces the exact problem.
- A request arriving after an idle stretch pays a container wake plus a browser launch, which is why `IMAGE_SERVICE_DEADLINE_MS` in `image-generator.ts` is 30s rather than a warm-render budget.
- The Dockerfile runs `tini` as PID 1. Chromium's children are reparented to PID 1 on browser exit and Node does not reap orphans, so without an init the launch/close cycle leaks zombie PIDs until the table is exhausted. Do not drop the `ENTRYPOINT`.

Railway builds this service from `html-to-image/Dockerfile`. That is now pinned in `html-to-image/railway.json` — previously it relied on Railway's "a Dockerfile always wins" auto-detection while the dashboard/API still reported the `RAILPACK` default, which reads as though the Dockerfile were dead config.

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

## Environment Setup

Copy `server/.env.template` to `server/.env`. Required for production; development defaults are safe for local use. The one required secret with no default is `OAUTH_TOKEN_SECRET` (32-byte hex string for AES-256).

Windows users: use `http://127.0.0.1` instead of `localhost` for cookies to work correctly.

## Testing Conventions

**Server**: Uses Node.js built-in `node:test` + `node:assert`. The suite is **dual-runtime**: it runs green under both Node (`bun run test`) and Bun (`bun run test:bun`, issue #269), so Bun's runner can serve as a CI gate for the #268 Bun-runtime epic. Test setup via `src/tests/test-bootstrap.js` which sets dummy env vars. Mock the DB with chainable builder objects; mock dependencies with the runtime-agnostic `mock` shim (see "Module Mocking in Server Tests" below).

**Client**: Uses Vitest + `@testing-library/react` + `happy-dom`. MSW is available for API mocking. Test setup file at `src/tests/setupTests.ts`.

CI runs all tests in a single unified workflow `.github/workflows/Tests.yml` targeting Node 24, with separate jobs for client, server, the Bun-runtime canary, `opengraph-service` (Go), and `html-to-image`.

The `html-to-image` job installs with `npm ci` rather than the root `bun install` — the service is deliberately outside the workspaces — and sets `PUPPETEER_SKIP_DOWNLOAD=true`, since its tests drive `createApp`/`createBrowserPool` through fakes and never launch a browser.

The `html-to-image/` service at the repo root is a standalone Express + Puppeteer image renderer. It has its own `app.test.js` using Node.js built-in `node:test`. Run its tests with:
```bash
cd html-to-image && node --test app.test.js
```

## Testing & Coverage

### Running Coverage

```bash
# Server (from server/)
bun run test:coverage

# Client (from client/)
bun run test -- --coverage
```

Target is 100% across all four v8 metrics: statements, lines, branches, functions.

### Coverage Exclusions

**Server** — excluded via the `c8.exclude` array in `server/package.json` (coverage is collected by `c8`, which wraps the node test runner):
- `src/lexicon/**` — auto-generated from AT Protocol lexicons
- `src/index.ts` — Express boot + process signal handlers
- `src/auth/client.ts`, `src/auth/storage.ts`, `src/auth/session.ts` — AT Protocol OAuth wiring
- `src/database/db.ts` — Kysely migration runner
- `src/lib/id-resolver.ts` — AT Protocol DID/handle resolver (requires live network)
- `src/lib/env.ts` — bootstrapped before tests run via `test-bootstrap.js`
- `src/routes.ts`, `src/routes/*.ts` — pure Express route wiring with no logic

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

### Module Mocking in Server Tests

The server test suite is **dual-runtime** (Node `bun run test` and Bun `bun run test:bun`, #269). Bun's runner recognizes `node:test`'s `test`/`describe`/`before*`/`after*`/`assert` but does **not** implement its `mock` API, so `mock` is imported from a runtime-agnostic shim instead:

```typescript
import assert from "node:assert";
import { test, describe, beforeEach, afterEach } from "node:test";
import { mock } from "./mock-shim"; // node:test's mock under Node, the shim under Bun
```

`src/tests/mock-shim.ts` reimplements `node:test`'s exact mock surface in pure JS (`mock.fn`, `mock.method`, `mock.timers`, `.mock.calls[i].arguments`, `mockImplementation/Once`, `resetCalls`) and delegates `mock.module`/`restoreAll` to the host runner (node:test under Node, bun:test under Bun — the two have **opposite** `mock.module` signatures: node:test takes `{ exports }`, bun:test takes `() => exports`; the shim adapts). Test files only swap the `mock` import — no call-site logic changes.

The default mocking strategy is **dependency injection** (chainable DB builders passed into constructors). `mock.module` is reserved for code that constructs a dependency at module scope with no injection seam — e.g. `auth-service.ts` → `session-agent.ts`'s `new Agent(...)`. The pattern, from `auth-service.test.ts`:

```typescript
let AuthService: typeof import("../services/auth-service").AuthService;
let mockAgent: { getProfile: (...args: any[]) => Promise<any> };

before(async () => {
  mockAgent = { getProfile: mock.fn(async () => ({ data: undefined })) };
  // Register the mock BEFORE importing the module under test so its
  // transitive import of session-agent picks up the fakes.
  await mock.module("../auth/session-agent", {
    exports: { initializeAgentForDid: async (ctx, did) => { /* ... */ mockAgent } },
  });
  const mod = await import("../services/auth-service");
  AuthService = mod.AuthService;
});
```

Notes:
- `mock.module` must run **before** the SUT is imported — so the SUT is loaded via a dynamic `import()` in `before()`, never a top-level static import.
- Mock the **nearest seam** to the SUT, not the deepest leaf. `auth-service.ts` imports `initializeAgentForDid` from `../auth/session-agent`; mocking that module (not `@atproto/api` directly) avoids having to re-export every other `@atproto/api` symbol (`RichText`, `AtpAgent`, …) that other transitively-imported modules use.
- **`mock.module` is file-scoped under both runtimes.** node:test scopes it to the test file natively; Bun's is process-global and **not restorable** (`clearAllMocks` clears `mock.fn` history but does not unmock modules), so the `test:bun` script passes `--isolate` to give each file a fresh module registry. Thanks to `--isolate`, a `mock.module` only needs to export the symbols the SUT actually calls — it does **not** have to mirror the full module surface (e.g. `auth-service.test.ts` mocks only `initializeAgentForDid`, leaving `initializeAgentFromSession` to the real module, which other files import).
- The mock should faithfully reproduce the real module's branching (e.g. return the e2e agent when present, `null` on restore-miss) so existing tests that rely on the real behavior keep passing.
- Use the `exports` option key, not the deprecated `namedExports`.

#### Bun-runtime specifics (#269, #270)

- `bun run test:bun` adds `--no-env-file` (Bun otherwise auto-loads `server/.env`'s real VAPID keys, which the dummy-env test bootstrap can't override) and `--isolate` (per-file module isolation).
- The `undici_v8` module-load crash (8.x `CacheStorage` ctor throws `webidl.util.markAsUncloneable is not a function` under Bun) and the `unicastFetchWrap` SSRF guard (which requires `process.versions.undici`, absent under Bun) are resolved by a **patched `@atproto-labs/fetch-node`** — see `patches/@atproto-labs%2Ffetch-node@0.3.5.patch` (applied via `patchedDependencies` in the root `package.json`). The patch lazy-imports `undici_v8` (so it never loads under Bun) and, under Bun, returns Bun's native fetch from `unicastFetchWrap` instead of the Node-undici SSRF dispatcher. This lets the server boot end-to-end under Bun (#270). SSRF defense is reduced vs. Node's unicast lookup, but the atproto handle resolver only fetches well-known AT Protocol / Bluesky endpoints.
- `c8` coverage stays on the Node path (`test:coverage`); the Bun path does not yet produce coverage.
