# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Does

Navyfragen lets Bluesky users receive anonymous questions and post answers directly to their Bluesky feed. Bluesky (AT Protocol) serves as both the identity provider (OAuth) and a secondary data store (PDS sync).

### Intentional architecture: NF messages are not linked to Bluesky posts

NF messages (stored in the centralised DB) are deliberately kept separate from Bluesky posts. There is no foreign-key or causal link between them at the data layer. This is intentional: NF messages are designed to be ephemeral (centralised storage until ATProto ships private PDS data). Once ATProto supports private data in the PDS, the plan is to drop the centralised NF DB entirely and link NF entities directly to Bluesky records. Any feature that associates an NF message with a Bluesky post must use client-side storage only (localStorage) — never persist that link server-side.

## Monorepo Structure

**Bun is the package manager** (single root `bun.lock`; installer swapped from npm per issue #250) and **the runtime for every TypeScript/JavaScript service** — the server (dev `bun --watch`, production `Dockerfile.server` on `oven/bun`, CI, and the test suite all run under Bun, #268) and the `html-to-image` renderer (#314, formerly Node + Puppeteer). The client runs its Vite dev server, build, lint, Vitest suite, and coverage under Bun too, with no Node required anywhere (see `client/CLAUDE.md`).

**Node is required in exactly one place: Playwright.** `E2E.yml` keeps `actions/setup-node`, and the root `test:e2e` scripts stay on plain `playwright test`. Playwright's runner cannot load our spec files under Bun — see "Playwright is the one Node holdout" in `docs/testing-notes.md` for the evidence. Every other script in every workspace routes through `bunx --bun` or is Bun-native, and all five Dockerfiles are `FROM oven/bun`. If you add a script that shells out to a node-shebang binary (`vite`, `vitest`, `tsc`, `oxlint`, `pino-pretty`, `rimraf`, `lex`, `husky`, `concurrently` all have one), route it through `bunx --bun` or it will silently run on Node wherever Node happens to be installed. `client/bunfig.toml` and `server/bunfig.toml` both set `[run] bun = true` as a second line of defence, so a forgotten flag in those two workspaces is caught by config; the repo root has no such setting, deliberately, so `test:e2e` keeps reaching Node.

The server HTTP layer is `Bun.serve` + [Hono](https://hono.dev) (#316): the former Express + cors + cookie-session + express-rate-limit + express-validator stack was migrated to native Hono middleware (hono/cors, hono/cookie signed sessions, hono-rate-limiter, @hono/zod-validator). Business logic (sharp, web-push, pino, node:dns/crypto) runs under Bun natively as before.

Root-level `bun run dev` runs all three workspaces concurrently via `concurrently` (the `html-to-image` image renderer is the third workspace member — Bun runtime + installer since #314, the same single-lockfile story as the server and client).

## Commands

Per-workspace scripts are in each `package.json`; `bun run dev` at the root runs client (5173) and server (3000) together. The client's `test:coverage` is the gate at 100% on all four metrics.

Two invocations you cannot guess from the manifest:

```bash
# a single server test file (the preload sets the dummy env vars the suite needs)
cd server && bun test --isolate --no-env-file --preload ./src/tests/test-bootstrap.js src/tests/message-service.test.ts

# regenerate AT Protocol lexicon types — never on Windows, it can delete the generated files; use WSL2
cd server && bun run lexgen
```

## Server Architecture

Route handlers → services, OAuth flow, the Kysely/`bun:sqlite` data layer, and the lexicon regeneration rules live in `server/CLAUDE.md`.

### Image Generation

Responding to a message with `includeQuestionAsImage: true` calls the in-house `html-to-image` service (`EXPORT_HTML_URL` env var, defaults to `http://localhost:3033/`). Image themes are defined in `src/lib/themes.ts` and stored per-user in `user_settings.imageTheme`.

The image service call uses `fetchWithRetry(url, init, timeoutMs)` (exported from `src/lib/image-generator.ts`) which retries on network errors with exponential backoff until the overall deadline is reached. Each individual request is bounded by an `AbortController`. If retries are exhausted the function throws — image generation failure is **not** silently downgraded to a text-only reply; the whole response attempt fails with the specific error message surfaced to the frontend.

Chromium must be absent, not merely idle, between renders, or Railway's app-sleeping never kicks in. The browser lifecycle rules (never prewarm on a timer, the one demand-driven `/warm` exception, the `tini` PID-1 requirement) live in `html-to-image/CLAUDE.md`.

#### Calling the image service

Both callers — `fetchWithRetry` in `server/src/lib/image-generator.ts` and `HTMLToImageRenderer.Render` in `opengraph-service/internal/shim/renderer.go` — must retry on **wake-shaped HTTP statuses** (408/502/503/504), not just on network errors. A sleeping service answers before it is ready: Railway's edge returns 502 while the container boots, and the service itself returns 503 while Chromium launches. Both are HTTP responses, so treating any response as final turns every wake into a user-visible failure. 4xx and 429 are deliberately *not* retried — a rejected payload fails identically every time, and retrying a limiter that is already shedding only adds load.

Retry budgets are per-attempt, not per-loop: a single hung connection must not consume the whole deadline and starve the retry that would have succeeded.

## Client Architecture

Client-specific conventions (React Query data layer, form validation, toast notifications, design tokens) live in `client/CLAUDE.md`.

Server-specific logging conventions live in `server/CLAUDE.md`.

## Code comments

A comment is the last resort, not the first. Work down this ladder and only write prose when all four rungs fail:

1. **Abstraction and encapsulation.** Business logic explained by a comment in a controller belongs in a domain-named service method instead. Arithmetic spelled out in a comment (`// 360px minus 32px body padding minus 36px bubble padding`) belongs in named constants that compute it. A repeated coercion explained in two places belongs in one named helper (`fromDbBoolean`, `toDbBoolean`).
2. **Human-readable subfunctions.** A comment labelling a block (`// Phase 2: cache lookup`, `// --- POST /login ---`) means the block wants to be a function, or the line below already says it. Name it and delete the label. Sentinel values get names too: `USE_APP_DEFAULT` beats `null // = use the default`.
3. **Unit tests that pin the rule, on both sides of its boundary.** A comment stating a business rule is a rule nothing enforces. Replace it with a pair of tests, one inside the boundary and one outside, named after the rule. A cap of five messages per inbox becomes "accepts a fifth message" and "rejects a sixth message", not `// max 5 per inbox`. The pair is the point: a single happy-path test documents a case, whereas the pair documents the limit and fails the day someone moves it. A comment goes stale silently.
4. **Integration/E2E tests for rules that only exist across a boundary.** Same idea one level up. A rule that only shows up end to end (cookie format, account switching, a settings round-trip clearing a field) gets a spec, not a paragraph above the code.
5. **Whatever 1-4 can't reach.** Hidden constraints, upstream bugs, production-incident history, protocol requirements, reachability arguments for coverage suppressions. These stay, but keep them tight: state the constraint, not its biography.

Tests augment the rule rather than merely restating it: the rule becomes executable, and the boundary that prose only asserted is now enforced. What is left over after the rule is pinned (a threat model, an incident, an upstream bug) is rung 5 and can stay, but it should be the residue, not the rule written twice.

### Point at the test that carries the rule

When rung 3 or 4 is what replaced a comment, leave a link to the test so the rule stays findable from the code it governs. Both toolchains resolve these, so use the native form:

- **TypeScript**: a markdown link in JSDoc, path relative to the file. VS Code renders it clickable on hover:
  ```ts
  /**
   * @see [ttl-cache.test.ts](../tests/ttl-cache.test.ts): pins expiry, the
   * eviction order, and the bound.
   */
  ```
- **Go**: a doc link to the test function. Tests are in the same package, so gopls resolves `[TestName]`:
  ```go
  // [TestFileCache_LoadDoesNotRefreshTTL] and [TestFileCache_LoadByPathUpdatesLRURecency]
  // pin both directions.
  ```

Say which rule the test pins, not just that one exists. A bare `@see` is noise.

`bun run check:doc-links` (run in CI by the `Doc Links` job in `Tests.yml`) fails on a relative markdown link in any TS/JS comment whose file is missing, and on a Go `[TestName]` doc link with no matching `func TestName`. Without it a renamed test rots the link silently, which is the same staleness problem the comment had.

The markdown side deliberately does not require the `@see` tag to be adjacent: JSDoc wraps, so the tag and the link often sit on different lines, and an earlier tag-anchored version of the checker passed a wrapped link that pointed at nothing. `bun run test:doc-links` pins that case and the rest of the checker's boundaries.

### What this does not license

Go doc comments on exported identifiers stay (idiomatic, and gopls/`go doc` surface them). Coverage pragmas (`/* istanbul ignore */`, `coveragePathIgnorePatterns` rationale in `bunfig.toml`) stay. `docs/testing-notes.md` remains the long-form home for every suppression argument; code comments should link to it rather than restate it.

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

The `Client Tests` job runs entirely on Bun and sets up **no Node at all**: `probe:bun` canary → `build` → `test:coverage`. There is no second client job; the Node one was retired when the coverage provider moved to istanbul.

The `html-to-image` job runs under Bun too (#314 — the service migrated from Node); its test setup and Chromium probe are described in `html-to-image/CLAUDE.md`.

## Testing & Coverage

Per-package coverage commands, targets, and exclusion lists live in `client/CLAUDE.md` and `server/CLAUDE.md`.

### Coverage Suppression Markers

Client-only: `/* istanbul ignore if | else | next */`, documented in `client/CLAUDE.md`. The `/* v8 ignore */` form is inert under the istanbul provider and there are none left in `client/src`.

Server: Bun's coverage reporter honors **neither** form, so per-file exclusion is done via `coveragePathIgnorePatterns` globs in `server/bunfig.toml`. The `/* v8 ignore */` markers still in server source are inert and kept only as documentation of the reachability argument.

Every suppressed site is catalogued in `docs/testing-notes.md`.

## Deployment (Railway)

Three rules, each of which has already broken production once. Do not relax any of them without reading `.claude/skills/railway-deployment/SKILL.md`, which carries the incident history, the service-by-service config, and the verification steps.

- **Every service builds from its Dockerfile, never Railway's native detection.** A RAILPACK build silently ignores the Bun-only `patchedDependencies` field and the server crashes on boot. A committed `railway.json` does nothing until the service's config-as-code path is set in the dashboard, so confirm with `get-service-config` that `build.builder` reads `DOCKERFILE`.
- **Production server services must bind a wildcard `HOST` (`::` or `0.0.0.0`), never a loopback address.** Caddy reaches them only over Railway's IPv6-only private network. `assertProductionBindHost()` enforces this at boot.
- **Anubis needs `ED25519_PRIVATE_KEY_HEX` set and its Valkey challenge store reachable before it starts.** Never add auth to that Valkey: Anubis cannot interpolate env vars into `botPolicy.json`, so the URL is a committed literal.
