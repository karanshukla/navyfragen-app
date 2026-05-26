# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Does

Navyfragen lets Bluesky users receive anonymous questions and post answers directly to their Bluesky feed. Bluesky (AT Protocol) serves as both the identity provider (OAuth) and a secondary data store (PDS sync).

## Monorepo Structure

npm workspaces with two packages:
- `client/` — React + Vite + TypeScript SPA (Mantine UI, React Query, React Router)
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
npm run lint       # ESLint
npm run test       # Vitest (single run)
npm run test:watch # Vitest watch mode
```

### Server (`cd server`)
```bash
npm run dev        # tsx watch with pino-pretty
npm run build      # tsup
npm run lint       # ESLint
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

Responding to a message with `includeQuestionAsImage: true` calls an external `monkeyphysics/html-to-image` service (`EXPORT_HTML_URL` env var, defaults to `http://localhost:3033/`). Run it locally with:
```bash
docker run --rm -p 3033:3033 monkeyphysics/html-to-image
```
Image themes are defined in `src/lib/themes.ts` and stored per-user in `user_settings.imageTheme`.

## Client Architecture

React Query is the data layer. Each domain (auth, messages, profile, settings) has a service file in `src/api/` that exports plain functions and React Query hooks:
- `src/api/apiClient.ts` — thin fetch wrapper; reads `VITE_API_URL` env var (defaults to `""`, so same-origin)
- `src/api/authService.ts` — exports `useSession`, `useLogin`, `useLogout`
- `src/api/messageService.ts`, `profileService.ts`, `settingsService.ts` — similar pattern

All API calls use `credentials: "include"` for cookie forwarding.

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

CI runs client and server tests independently in separate GitHub Actions workflows (`.github/workflows/ClientTests.yml` / `ServerTests.yml`), targeting Node 24.

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

**Server** — excluded via `--test-coverage-exclude` flags in the `test:coverage` script:
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

Adding a new exclusion requires a comment in `docs/testing-notes.md` explaining why and what it would take to test.

### `/* v8 ignore */` Convention

Use `/* v8 ignore next */` (or `/* v8 ignore next N */` for N lines) **only** for:
1. `catch {}` blocks that wrap non-throwing DOM operations (e.g. the AppHeader logout catch block that resets `body.style` — the try never throws in practice)
2. TypeScript-narrowed union branches that are structurally unreachable at runtime

Do **not** use it to skip real business logic. Document any usage in `docs/testing-notes.md`.

### Module Mocking in Server Tests

Controller and session-agent tests use `mock.module()` (Node.js v22.3+ API) to mock dependencies before a dynamic `import()` of the module under test. The pattern:

```typescript
before(async () => {
  mock.module("@atproto/api", {
    namedExports: { Agent: function(session) { return mockAgent; } },
  });
  const mod = await import("../controllers/some-controller.ts");
  SomeController = mod.SomeController;
});
```

`mock.module` must be called **before** the target module is imported. Always use `before()` + dynamic `import()` in test files that need module-level mocking — never top-level static imports of the module under test.
