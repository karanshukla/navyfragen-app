# Runtime notes: Bun everywhere, Node in one place

The CLAUDE.md files carry the rules. This file carries why each one exists.

## Bun is the package manager and the runtime

Single root `bun.lock` (installer swapped from npm in #250). The server runs under
Bun in dev (`bun --watch`), in production (`docker/Dockerfile.server` on `oven/bun`),
in CI, and in the test suite (#268). The `html-to-image` renderer migrated from
Node + Puppeteer to Bun in #314. The client runs its Vite dev server, build, lint,
Vitest suite, and coverage under Bun. All five Dockerfiles are `FROM oven/bun`.

The server HTTP layer is `Bun.serve` + [Hono](https://hono.dev) (#316); the former
Express + cors + cookie-session + express-rate-limit + express-validator stack was
migrated to native Hono middleware (hono/cors, hono/cookie signed sessions,
hono-rate-limiter, @hono/zod-validator). Business logic (sharp, web-push, pino,
node:dns/crypto) runs under Bun natively.

## Playwright is the one Node holdout

`E2E.yml` keeps `actions/setup-node`, and the root `test:e2e` scripts stay on plain
`playwright test`. Playwright's runner cannot load our spec files under Bun — see
"Playwright is the one Node holdout" in `docs/testing-notes.md` for the evidence.

## Why the `--bun` flag is load-bearing

`bun run <script>` hands a node-shebang binary to Node whenever Node is on PATH,
and `vite`, `vitest`, `tsc`, `oxlint`, `pino-pretty`, `rimraf`, `lex`, `husky`, and
`concurrently` all have one. So a bare `bun run build` silently ran on Node locally
while running on Bun inside `docker/Dockerfile.client` (which is `FROM oven/bun` and
ships no Node) — that production build path was the only place Vite ran under Bun,
and nothing tested it.

Every client script (`dev`, `build`, `preview`, `typecheck`, `lint`, `test`,
`test:watch`, `test:coverage`) routes through `bunx --bun`; `start` was already
`bun serve.ts`. Verified by shimming `node` on `PATH` to `exit 127` and running all
of them.

`client/bunfig.toml` and `server/bunfig.toml` set `[run] bun = true` as a second
line of defence, so a new `"foo": "vite something"` cannot silently run on Node
locally and Bun in Docker. The explicit `bunx --bun` in the scripts stays anyway,
since it reads at the call site and still applies when a script is invoked from
outside the workspace. The repo root deliberately has no such setting, because
`test:e2e` must keep reaching Node.

## CI canaries

- **Client** (`Client Tests`, no Node set up at all): `probe:bun` →
  `build` → `test:coverage`. `probe-bun-vite.mjs` asserts the runtime really is Bun
  and boots the Vite dev server to fetch a transformed TSX route — the dev server
  being the one Vite surface neither `vite build` nor Vitest touches.
- **Server**: `Probe SQLite data layer + OAuth handle resolution under Bun` runs
  ahead of the suite. E2E signs in through `/auth/e2e-login` with an app password and
  never resolves a handle, so without this the one production surface that runs
  through the patched `fetch-node` would be untested. Its Bun failure mode is silent
  — bluesky-social/atproto#3511 has resolution returning `undefined`, surfacing only
  as "does not resolve to a DID" — so the probe asserts a `did:` string comes back
  rather than trusting the call not to throw. The SQLite probe (`createDb` →
  `migrateToLatest` → insert/select through the `bun:sqlite` adapter) gates the data
  layer the test suite mocks around.
- **html-to-image**: `probe-bun-puppeteer.mjs` downloads Chromium explicitly and
  exercises the real spawn + CDP transport + screenshot round-trip. The unit tests
  drive `createApp`/`createBrowserPool` through fakes and never launch a browser,
  which is why CI installs with `PUPPETEER_SKIP_DOWNLOAD=true`.

## Server-side Bun specifics (#269, #270, #288)

- `bun run test` / `test:coverage` add `--no-env-file` (Bun otherwise auto-loads
  `server/.env`'s real VAPID keys, which the dummy-env test bootstrap can't override)
  and `--isolate` (per-file module isolation). Bun **1.3.14+** is required (the floor
  `@types/bun` is pinned to).
- The `undici_v8` module-load crash (8.x `CacheStorage` ctor throws
  `webidl.util.markAsUncloneable is not a function` under Bun) and the
  `unicastFetchWrap` SSRF guard (which requires `process.versions.undici`, absent
  under Bun) are resolved by a **patched `@atproto-labs/fetch-node`** — see
  `patches/@atproto-labs%2Ffetch-node@0.3.7.patch`, applied via `patchedDependencies`
  in the root `package.json`. The patch lazy-imports `undici_v8` (so it never loads
  under Bun) and gives `unicastFetchWrap` a Bun branch. **That branch still enforces
  the unicast rules**: it runs the package's own `unicastLookup` before the request,
  so a handle resolving to a loopback/private/link-local address is rejected exactly
  as on Node. Do not reduce it to the literal-IP check — `isUnicastIpHostname`
  returns `undefined` for a DNS name, so on its own it lets
  `http://internal.example.com/` straight through, and handle resolution fetches
  user-supplied hostnames. The branch also rejects non-HTTP(S) schemes, which the Node
  path got for free from undici: every unicast check keys on `url.hostname`, which is
  `""` for `file:`, and Bun's `fetch` reads `file:` URLs where Node's refuses them.
  The one gap versus the old Node path: the check runs before the connection rather
  than on the socket, so DNS rebinding between check and connect is not caught.
- **Never call `dns.setServers()` unconditionally.** Under Node it only rebinds the
  `dns.resolve*` family and leaves `dns.lookup` on getaddrinfo; under Bun it steers
  `dns.lookup` too, so the process forgets every name the system resolver owns —
  container DNS included. `src/index.ts` keeps its Windows TXT-lookup workaround gated
  behind `process.platform === "win32"` for that reason.
- **The listen address is negotiated, not hardcoded** (`listenPreferringDualStack`
  in `src/index.ts`). A wildcard `HOST` (`"::"` or `"0.0.0.0"`) binds `"::"` so a
  single dual-stack listener serves both families — required in production, where
  Caddy reaches this service only over Railway's private network and that network is
  IPv6-only (`BACKEND_DOMAIN = ${{Backend.RAILWAY_PRIVATE_DOMAIN}}`). Where the
  network has no IPv6 at all — every Docker bridge network in CI and local compose —
  the bind falls back to `"0.0.0.0"`; Bun surfaces that case as a spurious
  `EADDRINUSE` (`errno: 0`) instead of degrading the way Node does. A non-wildcard
  `HOST` is bound verbatim, so `HOST=127.0.0.1` still means loopback. In production a
  non-wildcard `HOST` is refused at boot (`assertProductionBindHost` in
  `src/lib/assert-production-bind-host.ts`, called first in `Server.create()`) — see
  `.claude/skills/railway-deployment/SKILL.md` for the 2026-07-25 outage (#298).
- The SQLite driver is `bun:sqlite` (`src/database/db.ts`), bridged onto Kysely's
  stock `SqliteDialect` via a small adapter (#263). `better-sqlite3` was removed in
  #288 when the Node code path was retired. Kysely's `SqliteDialect` is
  dialect-agnostic; the adapter only bridges two `bun:sqlite` API deltas (no `reader`
  flag → derived from `columnNames`; variadic params → spread).

## Client-side: Zod v4 must be imported as a namespace

Zod v4's entrypoint re-exports its own namespace (`import * as z from
"./v4/classic/external.js"; export { z }`), and Vite's dependency prebundle preserves
that as `export { external_exports as z }`. Reading that one binding under Bun yields
`undefined` while every other named export resolves, so `z.string()` throws at module
scope and takes the whole suite file down with it. A plain `import("zod")` under Bun
is fine, and so is Vite's `ssrLoadModule("zod")` — it only surfaces through Vitest's
module runner, which is why running the suite on Bun in CI is what guards it.

## Coverage provider: istanbul, not v8

`@vitest/coverage-v8` drives `node:inspector`'s Profiler domain, which Bun does not
implement — every worker throws `Error: Coverage APIs are not supported` and the run
reports 0% while still exiting green on the test count. istanbul instruments the
source at transform time and needs no V8 inspector, so it works on either runtime.
`@vitest/coverage-v8` is no longer a dependency. A side benefit: istanbul's lcov
carries real `BRDA` branch records, so unlike the server's Bun coverage the Coveralls
branch metric is meaningful.

Bun's own coverage reporter (server) honors neither `/* v8 ignore */` nor
`/* istanbul ignore */`, and its lcov carries line + function coverage only, with no
branch data (verified on 1.3.14). Per-file exclusion is done via
`coveragePathIgnorePatterns` globs in `server/bunfig.toml`. These are the accepted
trade-off of moving coverage onto the production runtime (#287); the prior c8/Node
path that did honor `v8 ignore` and report branches was retired with the Node test
path in #288. See "Coverage under Bun" in `docs/testing-notes.md`.
