# Server (`server/`)

## Architecture

Two layers: **route handlers → services**.

- `src/hono/*.ts` — Hono route handlers (request/response I/O, session checks, agent
  init), signed-cookie session middleware, Zod validators. Each domain (auth,
  message, profile, settings, notification) is a `create<Domain>Hono(ctx)` sub-app
  mounted in `src/index.ts`.
- `src/services/*.ts` — business logic, database access, AT Protocol calls.

`AppContext` (`src/index.ts`) carries `db`, `logger`, `oauthClient`, `resolver`, and
`idResolver` through the entire stack.

### Authentication

Client POSTs a handle to `/login` → AT Protocol OAuth redirect → `/oauth/callback`
stores the OAuth session in the DB and sets `c.var.session.did` via
`src/hono/session-middleware.ts`. Later authenticated requests restore the AT
Protocol `Agent` through `initializeAgentFromHonoSession()` in
`src/hono/session-agent-hono.ts` (a thin wrapper over `initializeAgentForDid`).

The session is intentionally thin — Bluesky OAuth is the authorization proxy, so an
expired Bluesky session invalidates the Navyfragen session too. The cookie is Hono's
signed-cookie (single `nf-session`, HMAC-SHA256), not wire-compatible with the former
cookie-session/keygrip scheme.

### Database

Kysely. SQLite in development (`:memory:` by default) via `bun:sqlite`, PostgreSQL in
production when `POSTGRESQL_URL` is set. Schema and migrations live entirely in
`src/database/db.ts` — add new ones as numbered keys (`"007"`, …) in the `migrations`
object; Kysely applies them in order at startup via `migrateToLatest()`.

### In-process state, and the replica count that makes it safe

`RenderService` (`src/services/render-service.ts`) holds finished question-image
renders in an in-process TTL cache until the user confirms the post. That is only
correct because a user's render and their polls land on the same process: both server
services run **one replica each** (`numReplicas: 1`, NA + EU), and `caddy/Caddyfile`
pins an authenticated session to a region by the `nf-region` cookie.

Deploy overlap is the one exposure — Railway starts the new instance before draining
the old, so for a minute or two a poll can hit a process that never saw the render.
Handled, not engineered away: a missing key reads as `unknown` and the client
re-renders. The work is pure and safe to redo.

> **Tripwire: the day `numReplicas` goes above 1 in either region, this breaks
> silently.** `lb_policy round_robin` has no stickiness, so polls would round-robin
> across instances and mostly miss. The result store then has to move to a **new,
> authenticated** Valkey — never the Anubis instance, which is deliberately
> passwordless (`.claude/skills/railway-deployment/SKILL.md`) and would then be
> holding anonymous question text.

### AT Protocol / lexicons

Custom lexicon `app.navyfragen.message` defines the message record type. Generated
types in `src/lexicon/` are **not** hand-edited — regenerate with `bun run lexgen`
(never on Windows; it can delete the generated files — use WSL2).

### Logging

Pino (`src/index.ts` → `createLogger()`). Development pipes stdout through
`pino-pretty`; production ships to Axiom via `@axiomhq/pino` when `AXIOM_TOKEN` and
`AXIOM_DATASET` are both set, falling back to stdout only.

Instrumented: the OAuth flow (login, callback success/failure, session creation,
token consumption, logout), anonymous message sent, response posted to Bluesky (with
AT URI), account deletion, PDS sync (with counts), settings changes. All 500-class
errors across controllers and services carry structured `{ err, did }` fields.

## Typechecking

```bash
bun run typecheck   # run from server/
```

One config, `tsconfig.json`, covering `src/` and `src/tests` alike. The client
splits app and test configs to keep a Node global out of app code; a server has no
reason to want that separation.

Nothing else compiles this workspace. Bun executes TypeScript by stripping types, so
`docker/Dockerfile.server` has no build step and `bun test` type-checks nothing
either — which is why this runs in the `Server Tests` job rather than being left to
a local habit.

## Testing & coverage

```bash
bun run test:coverage   # run from server/
```

97% lines, gated by Coveralls rather than by `bunfig.toml`: Bun's own
`coverageThreshold` exits 1 below 100% whatever it is set to, so none is set (setting
one previously forced a `continue-on-error` that swallowed test failures — see
`docs/testing-notes.md`). Bun's lcov has no branch data and honors no ignore markers,
so per-file exclusion goes in `coveragePathIgnorePatterns` in `bunfig.toml`. Check that
file for the current list and per-file rationale; it is the source of truth and can
drift ahead of this note. Adding an exclusion requires an entry in `docs/testing-notes.md`
explaining why and what it would take to test.

Mocking: dependency injection first (chainable DB builders passed into constructors),
`mock.module` only where a dependency is constructed at module scope with no seam.
The `bun:test` API surface, the `mock.module` pattern, and the `--isolate` footgun are
in `docs/server-test-mocking.md`. Bun-runtime specifics (the patched `fetch-node`,
`dns.setServers`, the negotiated listen address) are in `docs/runtime-notes.md`.
