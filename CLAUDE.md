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

Root-level `npm run dev` runs both concurrently via `concurrently`.

## Commands

### Root (runs both)
```bash
npm install        # install all workspaces
npm run dev        # start client (port 5173) and server (port 3000) together
```

### Client (`cd client`)
```bash
npm run dev        # Vite dev server
npm run build      # tsc + vite build
npm run lint       # oxlint
npm run test       # Vitest (single run)
npm run test:watch # Vitest watch mode
```

### Server (`cd server`)
```bash
npm run dev        # tsx watch with pino-pretty
npm run build      # tsup
npm run lint       # oxlint
npm run test       # Node.js built-in test runner (single run)
npm run test:watch # Node.js built-in test runner watch mode
npm run lexgen     # Regenerate AT Protocol lexicon types from ./lexicons/*.json
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

Kysely ORM. SQLite in development (`:memory:` by default), PostgreSQL in production (when `POSTGRESQL_URL` is set).

Schema and migrations live entirely in `src/database/db.ts`. Add new migrations as numbered keys (`"007"`, etc.) in the `migrations` object — Kysely applies them in order at startup via `migrateToLatest()`.

Key tables: `message` (tid, message, createdAt, recipient DID), `user_profile` (did, createdAt), `user_settings` (did, pdsSyncEnabled, imageTheme), `auth_session`, `auth_state`.

### AT Protocol / Lexicons

Custom lexicon `app.navyfragen.message` defines the record type for messages. Generated TypeScript types live in `src/lexicon/` — do **not** edit these manually; regenerate with `npm run lexgen`. Avoid running `lexgen` on Windows as it can delete generated files; use WSL2.

The `#/` path alias maps to `src/` (configured in `tsconfig.json` `paths`).

### Image Generation

Responding to a message with `includeQuestionAsImage: true` calls the in-house `html-to-image` service (`EXPORT_HTML_URL` env var, defaults to `http://localhost:3033/`). The service lives in `html-to-image/` at the repo root. Run it locally with:
```bash
docker build -t html-to-image ./html-to-image
docker run --rm -p 3033:3033 html-to-image
```
Image themes are defined in `src/lib/themes.ts` and stored per-user in `user_settings.imageTheme`. Available themes: `default` (dark gradient card), `compressed` (light minimal), `twitter` (square Twitter/X card).

The image service call uses `fetchWithRetry(url, init, timeoutMs)` (exported from `src/lib/image-generator.ts`) which retries on network errors with exponential backoff until the overall deadline is reached. Each individual request is bounded by an `AbortController`. If retries are exhausted the function throws — image generation failure is **not** silently downgraded to a text-only reply; the whole response attempt fails with the specific error message surfaced to the frontend.

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

## Environment Setup

Copy `server/.env.template` to `server/.env`. Required for production; development defaults are safe for local use. The one required secret with no default is `OAUTH_TOKEN_SECRET` (32-byte hex string for AES-256).

Windows users: use `http://127.0.0.1` instead of `localhost` for cookies to work correctly.

## Testing Conventions

**Server**: Uses Node.js built-in `node:test` + `node:assert`. Test setup via `src/tests/test-bootstrap.js` which sets dummy env vars. Mock the DB with chainable builder objects (see existing test files for the pattern).

**Client**: Uses Vitest + `@testing-library/react` + `happy-dom`. MSW is available for API mocking. Test setup file at `src/tests/setupTests.ts`.

CI runs all tests in a single unified workflow `.github/workflows/Tests.yml` targeting Node 24. The workflow has separate jobs for client, server, and html-to-image tests.

The `html-to-image/` service at the repo root is a standalone Express + Puppeteer image renderer. It has its own `app.test.js` using Node.js built-in `node:test`. Run its tests with:
```bash
cd html-to-image && node --test app.test.js
```

## Testing & Coverage

### Running Coverage

```bash
# Server (from server/)
npm run test:coverage

# Client (from client/)
npm run test -- --coverage
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

`node:test`'s `mock.module()` (still flagged `--experimental-test-module-mocks` on Node 24) lets a test replace a module's exports before the system-under-test imports it. The test scripts (`test`, `test:watch`, `test:coverage`) already pass the flag. The default mocking strategy is dependency injection (chainable DB builders passed into constructors); `mock.module` is reserved for code that constructs a dependency at module scope with no injection seam — e.g. `auth-service.ts` → `session-agent.ts`'s `new Agent(...)`. The pattern, from `auth-service.test.ts`:

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
- `mock.module` is called on the **test context** (`t.mock.module`) inside a test, or on the top-level `mock` import inside `before()`. It must run **before** the SUT is imported — so the SUT is loaded via a dynamic `import()` in `before()`, never a top-level static import.
- Mock the **nearest seam** to the SUT, not the deepest leaf. `auth-service.ts` imports `initializeAgentForDid` from `../auth/session-agent`; mocking that module (not `@atproto/api` directly) avoids having to re-export every other `@atproto/api` symbol (`RichText`, `AtpAgent`, …) that other transitively-imported modules use.
- The mock should faithfully reproduce the real module's branching (e.g. return the e2e agent when present, `null` on restore-miss) so existing tests that rely on the real behavior keep passing.
- Use the `exports` option key, not the deprecated `namedExports`.
