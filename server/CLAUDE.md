# Server (`server/`)

### Logging

The server uses Pino (`src/index.ts` → `createLogger()`). In development, stdout is piped through `pino-pretty` via the dev script. In production, when `AXIOM_TOKEN` and `AXIOM_DATASET` are both set, logs are shipped to Axiom via `@axiomhq/pino` as a transport target alongside stdout. Without those vars the logger falls back to stdout only.

Key events that are instrumented:
- OAuth flow: login initiation, callback success/failure, session creation, token consumption, logout
- Anonymous message sent, response posted to Bluesky (with AT URI)
- Account deletion, PDS sync (with counts)
- Settings changes (pdsSyncEnabled, imageTheme)
- All 500-class errors across controllers and services carry structured `{ err, did }` fields

## Testing & Coverage

Run coverage from `server/`:
```bash
bun run test:coverage
```

The **server** targets 97% via Bun's built-in coverage (`coverageThreshold = 0.97` in `server/bunfig.toml`), applied to **lines** — Bun's lcov carries line + function coverage only, with **no branch data** (verified on 1.3.14; documented in `docs/testing-notes.md`). Bun also does **not** honor `/* v8 ignore */` source annotations, so per-file exclusion is done via `coveragePathIgnorePatterns` globs in `bunfig.toml`. These two limitations are the accepted trade-off of moving coverage onto the production runtime (#287); the prior c8/Node path that did honor `v8 ignore` and report branches was retired with the Node test path in #288.

### Coverage Exclusions

Excluded via `coveragePathIgnorePatterns` in `server/bunfig.toml` (coverage is collected by Bun's built-in reporter) — check that file directly for the current list and per-file rationale; it is the source of truth and can drift ahead of this note.

Adding a new exclusion requires a comment in `docs/testing-notes.md` explaining why and what it would take to test.

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
- **The listen address is negotiated, not hardcoded** (`listenPreferringDualStack` in `src/index.ts`). A wildcard `HOST` (`"::"` or `"0.0.0.0"`) binds `"::"` so a single dual-stack listener serves both families — required in production, where Caddy reaches this service only over Railway's private network and that network is IPv6-only (`BACKEND_DOMAIN = ${{Backend.RAILWAY_PRIVATE_DOMAIN}}`). Where the network has no IPv6 at all — every Docker bridge network in CI and local compose — the bind falls back to `"0.0.0.0"`; Bun surfaces that case as a spurious `EADDRINUSE` (`errno: 0`) instead of degrading the way Node does. A non-wildcard `HOST` is bound verbatim, so `HOST=127.0.0.1` still means loopback. **In production a non-wildcard `HOST` is refused at boot** (`assertProductionBindHost` in `src/lib/assert-production-bind-host.ts`, called first in `Server.create()`) — a loopback bind boots "healthy" but is unreachable from Caddy, with no error signal in the server's own logs, which caused a full outage on both Railway server services on 2026-07-25 (#298). The guard is a no-op outside `NODE_ENV=production`, so local loopback testing and the test suite are unaffected. See "Production server services must bind a wildcard HOST" in the root CLAUDE.md.
- **The OAuth login path has its own CI probe** (`Probe SQLite data layer + OAuth handle resolution under Bun` in `Tests.yml`). E2E signs in through `/auth/e2e-login` with an app password and never resolves a handle, so without this the one production surface that runs through the patched `fetch-node` would be untested. Its Bun failure mode is silent — bluesky-social/atproto#3511 has resolution returning `undefined`, surfacing only as "does not resolve to a DID" — so the probe asserts a `did:` string comes back rather than trusting the call not to throw. The SQLite probe (`createDb` → `migrateToLatest` → insert/select through the `bun:sqlite` adapter) gates the data layer the test suite mocks around.
- Coverage comes from Bun's built-in reporter (`bun test --coverage`, configured in `server/bunfig.toml`). It does **not** honor `/* v8 ignore */` and its lcov carries line + function coverage only (no branch data) — see "Coverage under Bun" in `docs/testing-notes.md` for the rationale and accepted trade-offs.
