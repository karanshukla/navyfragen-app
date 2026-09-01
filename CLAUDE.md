# CLAUDE.md

Rules live here; the reasoning behind each lives in the linked doc. Workspace
specifics: `client/CLAUDE.md`, `server/CLAUDE.md`, `html-to-image/CLAUDE.md`.

## Comments: try four other things first

A comment is the last resort. Work down this ladder; write prose only when all four
rungs fail. Rationale and examples: `docs/comment-style.md`.

1. **Extract it.** Logic explained by a comment belongs in a domain-named service
   method; arithmetic spelled out in a comment belongs in named constants; a
   coercion explained twice belongs in one named helper.
2. **Name it.** A comment labelling a block (`// Phase 2: cache lookup`) means the
   block wants to be a function. Sentinels get names too (`USE_APP_DEFAULT`, not
   `null // = use the default`).
3. **Pin it with a test pair.** A comment stating a business rule is a rule nothing
   enforces. Write one test inside the boundary and one outside, named after the rule
   ("accepts a fifth message" / "rejects a sixth"), not `// max 5 per inbox`. The pair
   is the point: it fails the day someone moves the limit.
4. **Pin cross-boundary rules with an E2E spec.** Cookie format, account switching, a
   settings round-trip clearing a field — a spec, not a paragraph.
5. **Only then, prose.** Hidden constraints, upstream bugs, incident history,
   protocol requirements, coverage-suppression reachability arguments. State the
   constraint, not its biography.

When rung 3 or 4 replaced a comment, link the test from the code it governs — a
relative markdown link in JSDoc for TS, a `[TestName]` doc link for Go — saying which
rule it pins. `bun run check:doc-links` (CI job `Doc Links`) fails on broken ones.
Exempt from the ladder: Go doc comments on exported identifiers, and coverage pragmas.

## What this app does

Navyfragen lets Bluesky users receive anonymous questions and post answers to their
feed. Bluesky (AT Protocol) is both the identity provider (OAuth) and a secondary
data store (PDS sync).

**NF messages are deliberately not linked to Bluesky posts** — no foreign key, no
causal link at the data layer. NF messages are ephemeral (centralised storage only
until ATProto ships private PDS data, then the NF DB goes away entirely). Any feature
associating an NF message with a Bluesky post must use localStorage — never persist
that link server-side.

## Runtime: Bun everywhere, Node only for Playwright

Bun is the package manager (single root `bun.lock`) and the runtime for every JS/TS
service; all five Dockerfiles are `FROM oven/bun`. The server HTTP layer is
`Bun.serve` + [Hono](https://hono.dev). Why, plus the CI canaries and the Bun-specific
footguns: `docs/runtime-notes.md`.

- **Route any script that shells out to a node-shebang binary through `bunx --bun`**
  (`vite`, `vitest`, `tsc`, `oxlint`, `pino-pretty`, `rimraf`, `lex`, `husky`,
  `concurrently` all have one) or it silently runs on Node wherever Node is installed.
  `client/bunfig.toml` and `server/bunfig.toml` set `[run] bun = true` as a backstop;
  the repo root deliberately does not, so `test:e2e` keeps reaching Node.
- **Playwright is the only Node holdout** — `E2E.yml` keeps `actions/setup-node` and
  the root `test:e2e` scripts stay on plain `playwright test`.

## Commands

Per-workspace scripts are in each `package.json`; root `bun run dev` runs client
(5173), server (3000), and `html-to-image` (3033) together. Two you cannot guess:

```bash
# a single server test file (the preload sets the dummy env vars the suite needs)
cd server && bun test --isolate --no-env-file --preload ./src/tests/test-bootstrap.js src/tests/message-service.test.ts

# regenerate AT Protocol lexicon types — never on Windows, it can delete the generated files; use WSL2
cd server && bun run lexgen
```

## Image generation

Responding with `includeQuestionAsImage: true` calls the in-house `html-to-image`
service (`EXPORT_HTML_URL`, default `http://localhost:3033/`). Themes live in
`src/lib/themes.ts`, stored per-user in `user_settings.imageTheme`.

- **Failure is never silently downgraded to a text-only reply.** `fetchWithRetry`
  (`server/src/lib/image-generator.ts`) throws when retries are exhausted and the whole
  response attempt fails with that error surfaced to the frontend.
- **Both callers retry on wake-shaped statuses (408/502/503/504), not just network
  errors** — `fetchWithRetry` and `HTMLToImageRenderer.Render` in
  `opengraph-service/internal/shim/renderer.go`. A sleeping service answers before it
  is ready (Railway's edge returns 502 while the container boots, the service returns
  503 while Chromium launches), so treating any response as final turns every wake into
  a user-visible failure. 4xx and 429 are deliberately not retried.
- **Retry budgets are per-attempt, not per-loop**, so one hung connection cannot eat
  the deadline and starve the retry that would have succeeded.
- **Chromium must be absent, not merely idle, between renders**, or Railway's
  app-sleeping never kicks in — lifecycle rules in `html-to-image/CLAUDE.md`.

## Testing

Server: `bun:test` + `node:assert`, setup via `src/tests/test-bootstrap.js`
(`--preload`); mock the DB with chainable builders, DI over `mock.module`
(`docs/server-test-mocking.md`). Client: Vitest + `@testing-library/react` +
`happy-dom`, MSW available, setup in `src/tests/setupTests.ts`; `test:coverage` gates
at 100%. CI is one workflow (`Tests.yml`) with jobs for client, server,
`opengraph-service` (Go), and `html-to-image`.

Coverage suppression: the client uses `/* istanbul ignore */`; the server's Bun
reporter honors no marker at all, so per-file exclusion goes in `server/bunfig.toml`.
Every suppressed site is catalogued in `docs/testing-notes.md`.

## Typechecking is a CI job, because nothing else does it

Bun runs TypeScript by stripping types, so no test run and no server or
`html-to-image` Docker build ever type-checks anything. Only the client's
`vite build` does, and only over `src/`. Every `bun run typecheck` therefore has
to be wired into CI explicitly, and three of them are:

| Config                                               | Covers                                     | CI job                   |
| ---------------------------------------------------- | ------------------------------------------ | ------------------------ |
| `client/tsconfig.json` + `client/tsconfig.test.json` | client app, client tests                   | `Client Tests`           |
| `server/tsconfig.json`                               | server app **and** `server/src/tests`      | `Server Tests`           |
| `tsconfig.json` (root)                               | `e2e/`, `playwright.config.ts`, `scripts/` | `E2E & Script Typecheck` |

The root config is `allowJs`, so the `.mjs` checkers in `scripts/` are checked
against their JSDoc — annotate a new export's params and return there, or its callers
silently degrade to `any`.

## Environment setup

Copy `server/.env.template` to `server/.env`. Development defaults are safe locally;
the one secret with no default is `OAUTH_TOKEN_SECRET` (32-byte hex, AES-256). On
Windows use `http://127.0.0.1`, not `localhost`, or cookies break.

## Deployment (Railway)

Three rules, each of which has already broken production once. Do not relax any
without reading `.claude/skills/railway-deployment/SKILL.md` (incident history,
per-service config, verification steps).

- **Every service builds from its Dockerfile, never Railway's native detection.** A
  RAILPACK build silently ignores the Bun-only `patchedDependencies` field and the
  server crashes on boot. The builder is pinned in `.railway/railway.ts` and takes
  effect only once applied with `railway config apply`. Confirm with
  `get-service-config` that `build.builder` reads `DOCKERFILE`.
- **Production server services must bind a wildcard `HOST` (`::` or `0.0.0.0`), never
  a loopback address.** Caddy reaches them only over Railway's IPv6-only private
  network. `assertProductionBindHost()` enforces this at boot.
- **Anubis needs `ED25519_PRIVATE_KEY_HEX` set and its Valkey challenge store
  reachable before it starts.** Never add auth to that Valkey: Anubis cannot
  interpolate env vars into `botPolicy.json`, so the URL is a committed literal.

## Agent skills live in `.claude/skills/`, not `.agents/skills/`

Claude Code discovers project skills under `.claude/skills/` only, so anything the
`skills` CLI writes to `.agents/skills/` is inert here and fails silently. A skill also
needs a `!.claude/skills/` exception in `.gitignore`, or the `.claude/*` rule leaves it
present locally and absent for everyone else.
