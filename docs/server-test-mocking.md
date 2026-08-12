# Module mocking in server tests

The server test suite runs under `bun:test` (#288). Import `test`/`describe`/hooks/
`mock`/`spyOn` from `bun:test` and `assert` from `node:assert` (Bun runs
`node:assert` natively):

```typescript
import assert from "node:assert";
import { test, describe, beforeAll, afterEach, mock, spyOn } from "bun:test";
```

## The `mock` API, and how it differs from the old `node:test` shim

- Create a mock fn: `mock(impl?)` (was `mock.fn(...)`). Its `.mock.calls` is an
  array of **bare argument arrays** (`calls[0][0]`), not `[{ arguments }]` objects —
  read args as `m.mock.calls[0][0]`, not `.calls[0].arguments[0]`.
- `mockImplementation`/`mockImplementationOnce`/`mockReturnValue`/
  `mockReturnValueOnce` live on the function directly (`m.mockImplementation(...)`),
  **not** under `.mock`.
- Clear call history with `m.mockClear()` (was `m.mock.resetCalls()`); drop
  implementations with `m.mockReset()`; restore a spy with `m.mockRestore()`. Global
  cleanup: `mock.clearAllMocks()` (call history) and `mock.restore()` (restore all
  spies).
- Spy on a method (e.g. `globalThis.fetch`): `spyOn(globalThis,
  "fetch").mockImplementation(impl)` — `spyOn` takes no implementation arg; chain the
  impl on. `mock.method(target, name, impl)` from the old shim maps to this.
- `bun:test` uses `beforeAll`/`afterAll` (not `before`/`after`) for the
  once-per-file hooks.

## Dependency injection first, `mock.module` as the exception

The default mocking strategy is **dependency injection** (chainable DB builders
passed into constructors). `mock.module` is reserved for code that constructs a
dependency at module scope with no injection seam — e.g. `auth-service.ts` →
`session-agent.ts`'s `new Agent(...)`. The pattern, from `auth-service.test.ts`:

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

- `mock.module` must run **before** the SUT is imported — so the SUT is loaded via a
  dynamic `import()` in `beforeAll()`, never a top-level static import. Bun's
  `mock.module` takes a factory `() => exports` (the opposite of node:test's
  `{ exports }` shape) and is synchronous (returns `void`).
- Mock the **nearest seam** to the SUT, not the deepest leaf. `auth-service.ts`
  imports `initializeAgentForDid` from `../auth/session-agent`; mocking that module
  (not `@atproto/api` directly) avoids having to re-export every other `@atproto/api`
  symbol (`RichText`, `AtpAgent`, …) that other transitively-imported modules use.
- **`mock.module` is process-global and not restorable.** `mock.restore()` /
  `clearAllMocks()` clear mock call history and restore spies but do **not** unmock
  modules, so a partial mock registered in one file leaks into every other file that
  imports the real module. The `test`/`test:coverage` scripts pass `--isolate` for a
  fresh per-file module registry. Do not let `--isolate` be the only thing keeping a
  mock contained: **spread the real module into the mock**
  (`() => ({ ...realModule, theOneYouAreFaking })`) so a partial mock can't take out
  files that import the real exports with a missing-export `SyntaxError`.
- The mock should faithfully reproduce the real module's branching (e.g. return the
  e2e agent when present, `null` on restore-miss) so existing tests that rely on the
  real behavior keep passing.

## Hono handler tests (#316)

The `src/tests/*-controller.test.ts` files exercise the Hono route handlers via
Hono's own `app.request()` (real dispatch through route matching, Zod validation, and
response shaping), using an injected-session test helper
(`src/tests/helpers/hono-test.ts`) and mock services passed through the
`create<Domain>Hono(ctx, deps)` injection seam. The signed-cookie session I/O itself
(`src/hono/session-middleware.ts`) is covered by the E2E suite rather than unit
tests, so it's excluded from the coverage gate.
