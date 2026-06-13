# Testing Notes

This document explains coverage exclusions and hard-to-test code.

## `/* v8 ignore */` Usage

### `client/src/utils/parseRichText.tsx` — `toShortUrl` long-URL truncation branch

**Lines:** the `if (href.length > 80) { return href.slice(0, 76) + "…"; }` block inside `toShortUrl`.

**Why ignored:** This branch only fires when `safeUrlParse` returns `null` **and** the URL is longer than 80 characters. `safeUrlParse` returns `null` only for non-http/https protocols (e.g., `ftp://`, `javascript:`). The AT Protocol (Bluesky) only stores `http://` and `https://` links in rich text facets, so this path is structurally unreachable via the `@atcute/bluesky-richtext-parser` tokenizer used by `parseRichText`.

**What it would take to test:** Mock or swap the tokenizer to inject a fake link segment whose `url` field is a non-http protocol string of more than 80 characters (e.g., `ftp://` + `a`.repeat(75)). Alternatively, export `toShortUrl` and test it directly.

### `server/src/services/auth-service.ts` — `agent.getProfile()` block in `checkSession`

**Lines:** the `agent.getProfile()` call and the following data extraction inside `checkSession`.

**Why ignored:** This block calls AT Protocol methods on a live `Agent` instance. `mock.module` is unavailable under `tsx` (CJS transform), so the `Agent` constructor cannot be intercepted at the module level. The `agent.getProfile()` method requires a live Bluesky network session.

**What it would take to test:** Switch the test runner to use native ES modules (enabling `mock.module`), or refactor `checkSession` to accept an injected `Agent`-like interface that can be replaced in tests.

### `client/src/Navigation.tsx` — unreachable `null` tail of friends ternary

**Line:** the trailing `: null` in `{friendsLoading ? ... : friends.length > 0 ? ... : !friendsLoading ? ... : null}`.

**Why ignored:** This `null` branch is structurally unreachable. The outer ternary only reaches the `else` arm when `friendsLoading` is falsy; at that point the inner guard `!friendsLoading` is always `true`, so the final `null` can never be evaluated at runtime.

**What it would take to test:** Not possible through React rendering — the branch requires `friendsLoading` to be simultaneously falsy (to skip the loading skeleton) and truthy (to skip the empty-state text).

### `client/src/api/profileService.ts` — disabled-query reject branches in `usePublicProfile` and `useResolveHandle`

**Lines:** `Promise.reject("No DID provided")` inside `usePublicProfile`'s `queryFn`, and `Promise.reject("No handle provided")` inside `useResolveHandle`'s `queryFn`.

**Why ignored:** Both hooks set `enabled: !!did` / `enabled: !!handle`, so React Query never calls `queryFn` when the argument is null. These reject branches are structural guards that can only fire if the queryFn is invoked directly outside of React Query's normal flow.

**What it would take to test:** Call `refetch()` on the hook rendered with a null argument; React Query v5 will then invoke `queryFn` regardless of `enabled`. (This was attempted but the disabled-query refetch behaviour is inconsistent across React Query versions, so the branches are ignored instead.)

### `server/src/lib/image-generator.ts` — outer `catch` block in `generateQuestionImage`

**Lines:** the top-level `catch (imgErr)` in `generateQuestionImage`.

**Why ignored:** This catch wraps the entire image generation pipeline. The inner operations (sharp, fetch) are individually testable and their failure paths are exercised in the test suite. The outer catch would only fire if something unexpected escaped all inner error handling — a structurally unlikely scenario given the current code paths are all covered.

**What it would take to test:** Inject a mock for `sharp` that throws synchronously at the import level, or export an internal function whose throw can be observed before the outer catch suppresses it.

### `server/src/lib/image-generator.ts` — `LOGO_DATA_URL` ternary false branch in `generateTwitterHtml`

**Line:** the `"NF"` false branch of `LOGO_DATA_URL ? \`<img src="${LOGO_DATA_URL}" ... />\` : "NF"` inside the HTML template literal.

**Why ignored:** `LOGO_DATA_URL` is a module-level constant populated by reading and base64-encoding the logo PNG at import time. It is always a non-empty string when the module loads successfully; the `"NF"` fallback is a dead code path under any realistic execution. V8 counts each arm of the ternary as a branch, so the false arm shows as uncovered.

**What it would take to test:** Mock the `fs.readFileSync` call at module load time to return an empty buffer (so `LOGO_DATA_URL` becomes `""`), then re-import the module. This requires `mock.module` wrapping the Node.js `fs` module before the dynamic import of `image-generator.ts`.

### `client/src/pages/PublicProfile.tsx` — defensive max-length guard in `handleSend`

**Lines:** lines 86–89 (`if (message.length > MAX_MESSAGE_LENGTH) { setFormError(...); return; }`).

**Why ignored:** The `<Textarea>` component's `onChange` handler unconditionally rejects any value longer than `MAX_MESSAGE_LENGTH` (`if (e.target.value.length <= MAX_MESSAGE_LENGTH) setMessage(...)`). As a result, the React `message` state can never exceed the limit through the UI, making the `handleSend` guard permanently unreachable in practice.

**What it would take to test:** Export `handleSend` for direct unit testing, or access the component's internal state setter to bypass the `onChange` guard. Neither is practical without refactoring the component.

## TypeScript Transpilation Artifacts (tsx source-map gaps)

The following "uncovered" lines are not executable TypeScript — they are blank lines, type annotations, or closing punctuation of multi-line expressions that tsx maps back to the wrong source position. The underlying code **is** executed and tested; only V8's source-map alignment is imprecise.

| File | Lines | Kind |
|------|-------|------|
| `server/src/services/auth-service.ts` | 77 | `const cryptr = new Cryptr(secret)` in `decryptDid` — identical structure to `encryptDid` above it; tsx maps both to the same JS position |
| `server/src/services/message-service.ts` | 80, 106, 162, 297, 303 | Blank lines, TypeScript parameter-type annotations, and closing-parenthesis lines of multi-line `logger.error(...)` calls |
| `server/src/services/settings-service.ts` | 128 | Blank line between `getUserSettings` call and `if (!existingSettings)` inside `updateSettings` |
| `server/src/lib/image-generator.ts` | 144, 454–459 | TypeScript return-type annotation on `generateThemeSpecificHtml` (line 144); static CSS string content inside a multi-hundred-line template literal in `generateTwitterHtml` (lines 454–459) — V8 does not track every line within a template literal |

No `/* v8 ignore */` annotations are added for these because the underlying logic IS reached by tests; the gaps are purely a source-map rendering artefact.

## Coverage Exclusions (via config)

The following files are excluded from coverage metrics entirely. See the root-level notes in `CLAUDE.md` under "Coverage Exclusions".

**Server** (excluded via `--test-coverage-exclude` in `package.json`):
- `src/lexicon/**` — auto-generated AT Protocol types
- `src/index.ts` — Express boot + signal handlers
- `src/auth/client.ts`, `src/auth/storage.ts`, `src/auth/session.ts` — OAuth wiring
- `src/database/db.ts` — Kysely migration runner
- `src/lib/id-resolver.ts` — requires live network
- `src/lib/env.ts` — bootstrapped before tests
- `src/routes.ts`, `src/routes/*.ts` — pure Express wiring

**Client** (excluded via `coverage.exclude` in `vite.config.ts`):
- `src/tests/**`, `src/main.tsx`, `src/Theme.tsx` — test infra and entry point
- `src/vite-env.d.ts` — ambient declarations
- `src/styles/tokens.ts` — pure style constants
