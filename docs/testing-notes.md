# Testing Notes

This document explains coverage exclusions and hard-to-test code.

## Coverage Suppression Markers

Two different conventions, because the two workspaces measure coverage differently:

- **Client** — Vitest's **istanbul** provider. Suppress with `/* istanbul ignore if */`, `/* istanbul ignore else */`, or `/* istanbul ignore next */`. The `/* v8 ignore */` form is inert here and there are none left in `client/src`.
- **Server** — Bun's built-in reporter, which honors **neither** form. Suppression is per-file only, via `coveragePathIgnorePatterns` globs in `server/bunfig.toml`. The `/* v8 ignore */` markers still present in server source are inert; they are kept as documentation of the reachability argument, not as working annotations.

istanbul only attaches a hint to statement-, function-, and `if`-level nodes. A marker in front of a bare sub-expression is silently dropped, which is why two client sites (`Customise.tsx`'s locale `onChange` and `profileService.ts`'s `initialDataUpdatedAt`) were rewritten into block bodies so there was a statement to mark.

Entries below explain why each suppressed site is unreachable and what testing it would take.

### Suppressions dropped in the Node-free migration

These client sites carried `/* v8 ignore */` markers that istanbul does not need — it measures them as covered, so the markers were removed rather than translated: `parseRichText.tsx`'s `toShortUrl` long-URL truncation, its `safeUrlParse` `return null` tail, and its unknown-segment-type `default` arm; `Navigation.tsx`'s friends-ternary `null` tail; `AppHeader.tsx`'s `onLogout` catch; the two `profileService.ts` localStorage catches (since consolidated into `lib/safeLocalStorage.ts`); and `Home.tsx`'s share-sheet catch. Most were v8 source-map or JIT artifacts rather than genuinely unreachable code, which is why they disappear under source instrumentation. The four empty `catch {}` blocks kept a plain explanatory comment so the block still reads as deliberate.

### `server/src/services/auth-service.ts` — `agent.getProfile()` block in `checkSession`

**Status: now tested.** This block was previously ignored because `node:test`'s `mock.module()` was unavailable under the CJS `tsx` transform. After the ESM migration (#216) it became reachable: `auth-service.test.ts` mocks `../auth/session-agent` via `mock.module()` (registered in a `before()` hook before dynamically importing `auth-service`) so `initializeAgentForDid` returns a fake agent whose `getProfile` is controlled per-test. The block now has full coverage (success path, `!data` branch, optional-field fallbacks, getProfile rejection). See the `checkSession` tests for the pattern.

### `client/src/components/AppHeader.tsx` — unreachable `did === activeDid` guard in `handleSwitch`

**Line:** `if (did === activeDid || isSwitching) return;` inside `handleSwitch` (the account-switcher's `UserMenu`).

**Why ignored:** The `Menu.Item` for the currently-active account is rendered with `disabled={isActive || isSwitching}`, and Mantine/JSDOM do not dispatch click events to disabled buttons. `handleSwitch` can therefore only ever be invoked with `did !== activeDid` through the UI, making the `did === activeDid` arm of the guard permanently unreachable in tests. It's kept in the source as defense-in-depth in case the disabled state and the handler ever fall out of sync.

**What it would take to test:** Call `handleSwitch` directly (bypassing the disabled menu item) by exporting it or via a component ref, with `did` equal to `activeDid`.

### `client/src/components/AppHeader.tsx` — `handleSwitch` catch block that resets `body.style`

**Lines:** the `catch { document.body.style.pointerEvents = ""; document.body.style.opacity = ""; }` block inside `handleSwitch` (the account-switcher's `UserMenu`).

**Why ignored:** The `try` only assigns string literals to `document.body.style`, which never throws in practice. Marked with a single `/* istanbul ignore next */` on the `try` statement — istanbul has no catch-only hint, so the whole `try`/`catch` comes out of the denominator. (The `onLogout` handler a few lines above has the same shape but needs no marker at all: its `try` calls `logout()`, which a test does make throw.)

**What it would take to test:** Not worth pursuing — would require mocking `document.body.style` property assignment to throw, which doesn't reflect any real browser behavior.

### `client/src/pages/Customise.tsx` — unreachable `null` fallback in both locale `Select`s' `onChange`

**Lines:** `touchpointLocale: value || null` inside the "Message language" `Select`'s `onChange`, and `uiLocale: value || null` inside the "App language" `Select`'s `onChange` beside it (the latter reachable at all only since #406 gave `uiLocaleOptions` a second entry — see below).

**Why ignored:** Mantine's `Select` `onChange` signature is typed to allow `value: string | null`, but `null` is only ever passed when the currently-selected option is deselected, which requires `allowDeselect` (or `clearable`) to be enabled. Both `Select`s are rendered with `allowDeselect={false}` and no clear affordance, so every `onChange` reachable through the rendered UI carries one of the non-empty locale codes from `touchpointLocales`/`uiLocaleOptions` — `value` is always truthy in practice. The `|| null` exists to satisfy the handler's declared parameter type, not to handle a reachable UI state.

**Marker placement:** each `onChange` arrow was rewritten from a concise body to a block body so `/* istanbul ignore next */` has a statement to attach to. Inline on the `value || null` expression it does nothing.

**What it would take to test:** Call the `Select`'s `onChange` prop directly (bypassing rendering) with `null`, e.g. by extracting the handler to a named, exported function, or by asserting on the prop passed to a mocked `Select`.

### `client/src/lib/i18n/index.tsx` — `loadCatalog` loader lookup and `try`/`catch` (resolved by #406)

**Status: no longer ignored.** `LOCALE_LOADERS` had no entries before #406 registered `es`, so `loader` was always `undefined` and the `if (!loader)`/`try`/`catch` machinery around it was structurally dead. With a real entry in place, `i18n.test.tsx`'s `loadCatalog` suite now exercises all three outcomes directly — `loadCatalog("es")` resolving the real catalog, `loadCatalog("en")`/an unregistered locale taking the `!loader` branch, and a rejecting loader (mocked via `vi.doMock` on `./es`) falling back to `en` through the `catch`. Both `/* istanbul ignore else */` and `/* istanbul ignore next */` markers were removed.

### `client/src/pages/Customise.tsx` — App language `Select`'s `onChange` (resolved by #406)

**Status: no longer ignored.** `uiLocaleOptions` had exactly one entry (`en`) before #406 added `es`, so the `Select`'s displayed value and its only `data` option were always the same, and Mantine never fired `onChange` through the rendered UI. With a second option in place, `Customise.test.tsx` picks `es` from the "App language" `Select` the same way its "picking a locale" test already did for "Message language", and the `/* istanbul ignore next */` that wrapped the whole handler was removed — the `value || null` fallback inside it picked up its own marker instead (see the combined entry above).

### `client/src/pages/Settings.tsx` — unreachable `!installPrompt` early-return guard

**Line:** `if (!installPrompt) return;` inside `handleInstallClick`.

**Why ignored:** The Install button that calls `handleInstallClick` is rendered with `disabled={!installPrompt}`. Mantine's `<Button disabled>` does not invoke `onClick` in the browser (or in JSDOM via `fireEvent.click`), so `handleInstallClick` can only be called when `installPrompt` is non-null, making the `!installPrompt` guard permanently unreachable through the UI.

**What it would take to test:** Call `handleInstallClick` directly (bypassing the button's disabled state) by exporting it or via a component ref, with `installPrompt` set to `null`.

### `client/src/api/profileService.ts` — disabled-query reject branch in `useUserExists`

**Line:** `Promise.reject("No DID provided")` inside `useUserExists`'s `queryFn`.

**Why ignored:** Same pattern as `usePublicProfile` and `useResolveHandle` (already documented below). `enabled: !!did` prevents React Query from calling `queryFn` when `did` is null. The reject branch is a structural guard that cannot fire through normal React Query flow.

**What it would take to test:** Same approach as the other disabled-query hooks — call `refetch()` on the hook rendered with a null argument; React Query v5 invokes `queryFn` regardless of `enabled` on explicit refetch.

### `client/src/api/profileService.ts` — `initialDataUpdatedAt` unreachable branches in `useFriends`

**Line:** `initialDataUpdatedAt: () => (did ? getCachedFriends(did)?.timestamp : undefined) ?? undefined`

**Why ignored:** React Query only calls `initialDataUpdatedAt` when `initialData` returns a non-undefined value, which only happens when `did` is non-null and the localStorage cache is valid. In that scenario: (1) the ternary's false arm (`did` is null → `undefined`) is structurally unreachable; (2) `getCachedFriends(did)?.timestamp` always returns a number (the stored `Date.now()` timestamp), so the `?.` null path and the `?? undefined` right-hand side are also unreachable.

**Marker placement:** the arrow function was rewritten from a concise body to a block body with an explicit `return`, so there is a statement for `/* istanbul ignore next */` to attach to. A marker in front of the object property, or in front of the arrow itself, is silently dropped.

**What it would take to test:** Mock `getCachedFriends` to return a partial object missing the `timestamp` field while still having `data`, so that `?.timestamp` returns `undefined` and the `?? undefined` fallback is exercised.

### `client/src/api/profileService.ts` — disabled-query reject branches in `usePublicProfile` and `useResolveHandle`

**Lines:** `Promise.reject("No DID provided")` inside `usePublicProfile`'s `queryFn`, and `Promise.reject("No handle provided")` inside `useResolveHandle`'s `queryFn`.

**Why ignored:** Both hooks set `enabled: !!did` / `enabled: !!handle`, so React Query never calls `queryFn` when the argument is null. These reject branches are structural guards that can only fire if the queryFn is invoked directly outside of React Query's normal flow.

**What it would take to test:** Call `refetch()` on the hook rendered with a null argument; React Query v5 will then invoke `queryFn` regardless of `enabled`. (This was attempted but the disabled-query refetch behaviour is inconsistent across React Query versions, so the branches are ignored instead.)

### `server/src/services/auth-service.ts` — `if (!secret)` guards in `encryptDid` and `decryptDid`

**Lines:** `if (!secret) throw new Error("OAUTH_TOKEN_SECRET is not set")` in both `encryptDid` (line 70) and `decryptDid` (line 78).

**Why ignored:** `env.OAUTH_TOKEN_SECRET` is resolved by `envalid.cleanEnv()` at module load time and cached as a module-level constant. `test-bootstrap.js` sets `process.env.OAUTH_TOKEN_SECRET` before any test file imports `auth-service.ts`, so the cached value is always a non-empty string for the lifetime of the test process. The `!secret` truthy branch is structurally unreachable in tests.

**What it would take to test:** Restructure the module to read `process.env.OAUTH_TOKEN_SECRET` at call time (not module load), or use `mock.module()` with a dynamic import to replace the `env` object.

### `server/src/lib/image-generator.ts` — outer `catch` block in `generateQuestionImage`

**Status: now tested (correction to a prior note).** This block was previously marked `/* v8 ignore next 4 */` on the theory that it was structurally unreachable — that all inner operations had their own failure handling and nothing could escape to the outer catch. That was wrong: `sharp(raw).resize(...).png(...).toBuffer()` has no inner try/catch of its own, and `sharp` rejects synchronously when the image service returns a 200 response with a body that isn't valid image data (a real scenario — a misbehaving or compromised upstream). `image-generator-generate.test.ts`'s `"returns empty object when image processing throws"` test feeds `generateQuestionImage` a 200 response with a non-PNG body, which throws inside `sharp(...).toBuffer()` and is caught by the outer `catch (imgErr)`, asserting both the `{}` return and the `logger.error` call. The `/* v8 ignore next 4 */` annotation was removed since Bun doesn't honor it anyway (see "Coverage under Bun" below) and the block is real, reachable business logic.

### `server/src/lib/image-generator.ts` — `imageGenerator` exported object closing brace

**Line:** the `};` closing of `export const imageGenerator = { generateQuestionImage, };`.

**Why ignored:** V8 records an implicit branch for the "object literal not initialised" path at the last punctuation of a module-level `const` export. Since the module is always fully executed on import, this arm is never taken — the same JIT artifact as the class-closing-brace pattern in class-based modules, but manifesting on the exported object literal instead.

**What it would take to test:** Not possible — this is a V8 JIT internal; no user-written test can exercise the "object not initialised" branch.

### `server/src/lib/image-generator.ts` — `LOGO_DATA_URL` ternary false branch in `generateTwitterHtml`

**Line:** the `"NF"` false branch of `LOGO_DATA_URL ? \`<img src="${LOGO_DATA_URL}" ... />\` : "NF"` inside the HTML template literal.

**Why ignored:** `LOGO_DATA_URL` is a module-level constant populated by reading and base64-encoding the logo PNG at import time. It is always a non-empty string when the module loads successfully; the `"NF"` fallback is a dead code path under any realistic execution. V8 counts each arm of the ternary as a branch, so the false arm shows as uncovered.

**What it would take to test:** Mock the `fs.readFileSync` call at module load time to return an empty buffer (so `LOGO_DATA_URL` becomes `""`), then re-import the module. This requires `mock.module` wrapping the Node.js `fs` module before the dynamic import of `image-generator.ts`.

### `client/src/utils/parseRichText.tsx` — protocol-prefix guard for auto-detected domain links

**Line:** `if (!/^https?:\/\//.test(href)) { href = "https://" + href; }` inside the `text`-segment auto-linking loop in `parseRichText`.

**Why ignored:** `matchText` comes from `bareDomainRegex`, whose domain-segment pattern (`(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}`) requires a literal `.` immediately before the TLD. `http:` and `https:` contain no `.` before their `:`, so the regex engine can never start a match there — verified empirically (`bareDomainRegex.exec("https://example.com/path")` returns `"example.com/path"`, never including the scheme). `matchText` is therefore always a bare domain, so the guard's "already has a protocol" false arm is structurally unreachable.

**What it would take to test:** Not possible through `parseRichText`'s public behavior — would require calling the auto-linking logic directly with a hand-crafted `matchText` that already includes a scheme, bypassing the regex that makes this guard necessary in the first place.

### `client/src/utils/parseRichText.tsx` — non-http protocol fall-through in `safeUrlParse`

**Line:** the implicit else of `if (url.protocol === "https:" || url.protocol === "http:") { return url; }`.

**Why ignored:** New under istanbul; v8 folded this branch away. `safeUrlParse` routes its input through `ensureProtocol`, which prepends `https://` to any href that does not already start with `http://` or `https://`, so by the time `new URL()` succeeds the parsed protocol is always one of the two the guard accepts. The else path, which falls through to `return null`, is unreachable for that reason rather than by caller discipline. Marked `/* istanbul ignore else */`.

**What it would take to test:** Not reachable through the module's exports. It would need `safeUrlParse` called with a string that survives the protocol prepend and still parses to some third scheme, which the prepend makes impossible.

### `client/src/api/messageService.ts` — disabled-query reject branch in `useMessages`

**Line:** the `Promise.reject("No DID provided")` inside `useMessages`'s `queryFn`.

**Why ignored:** Same pattern as `profileService.ts` — `enabled: !!did` prevents React Query from calling `queryFn` when `did` is null. This reject branch is a structural guard that can never fire through normal React Query flow.

**What it would take to test:** Same approach as `profileService.ts` — call `refetch()` on the hook rendered with a null argument; React Query v5 invokes `queryFn` regardless of `enabled` on explicit refetch.

### `client/src/pages/PublicProfile.tsx` — defensive max-length guard in `handleSend` (removed)

**Status: gone.** The guard existed because the textarea's `onChange` rejected any
value over `MAX_MESSAGE_LENGTH` outright, so `handleSend` could never see an
over-long message. The frontend refactor moved the composer into
`components/profile/AskCard.tsx`, whose `onChange` truncates
(`value.slice(0, maxLength)`) instead of rejecting — pasting a long string now
keeps the first 150 characters rather than nothing. With the invariant enforced by
construction at the only entry point, the second check in `handleSend` had nothing
left to defend and was deleted along with its marker.

### `client/src/pages/Messages.tsx` — collapsed reply Box/Button handlers (correction to a prior note)

A previous version of this note claimed the collapsed `↩ Reply` Box's `stopPropagation` handler and the collapsed Button's `onClick` body were uncovered due to a Vitest/v8 source-map alignment bug with arrow functions nested in the non-first branch of a JSX ternary. That diagnosis was wrong. The real cause: `screen.getAllByRole("button", { name: /reply/i })` matches **both** the outer message-card `<Paper role="button">` (whose aggregated accessible name includes the nested "↩ Reply" text) **and** the actual nested `<button>` element. `.find((b) => b.textContent?.includes("↩"))` picked the first DOM-order match, which is the outer Paper card — so those "collapsed button" tests were actually clicking the card itself (which has its own unguarded `onClick` that produces the same visible outcome), never the real nested Box/Button. Querying with an **exact** name match (e.g. `screen.getAllByRole("button", { name: "↩ Reply" })`, exact matching excludes the Paper since its full accessible name is longer) or `document.querySelectorAll("button")` reliably isolates the real element and exercises these handlers normally — no ignore annotation or tooling workaround is needed. See `Messages.test.tsx` for the corrected tests ("collapsed reply Box wrapper stops click propagation…", "collapsed reply Button (exact match) opens the response box…", "collapsed reply Button does nothing when blocked…").

### `client/src/pages/Messages.tsx` — six structurally-unreachable defensive guards (five removed)

**Status: one left.** These were six guards whose unhappy arm could not be reached
given the call graph — the kind of suppression that is correct but accumulates. The
frontend refactor removed the _reason_ for five of them rather than re-annotating
them, which is the preferred outcome:

- `handleDeleteRequest`'s `if (threadRootTid === tid) return;` — deleted. It
  duplicated a check the trash `ActionIcon` already performs, and that button now
  lives in `QuestionCard`, where the check is visibly adjacent to the affordance.
- `handleConfirmDelete`'s `if (messageIdToDelete)` — deleted. The modal's
  `onConfirm` asserts non-null (`performDelete(messageIdToDelete!, true)`), which
  states the same invariant to the type system instead of to the coverage tool.
- `handlePrepareResponse`'s `if (idx !== -1)` — deleted. `QuestionGrid` maps over
  the message list, so expanding a card already knows its index; there is no lookup
  to fail.
- The auto-scroll effect's `newestCard ?? messagesTopRef.current` fallback and its
  `if (target)` guard — collapsed to a single early return. The spare ref that
  existed only as a fallback target is gone too.
- The global Escape handler's `if (idx !== -1)` — deleted. `useCardKeyboardNav`
  receives `expandedIndex` as a prop and already gates on `!== -1` before using it,
  so the inner re-check was the same condition twice.

What remains is the `setTimeout` callback in the expand-scroll effect
(`QuestionGrid.tsx`), which the suite's fake timers never run, plus a
`/* istanbul ignore next */` on `if (!newest) return;` in `useScrollToNewMessages`,
where a message present in the list always has a card rendered in the same commit.

**What it would take to test:** for the timer, run the suite with real timers and a
`scrollIntoView` spy; for the `newest` lookup, render a message list whose first
entry has no corresponding DOM node, which no code path produces.

## V8 JIT Module-Scope Artifacts

### `server/src/lib/image-generator.ts` — module-scope artifact on import block

**Lines:** 1–3 (the import statements).

**Why suppressed with `/* v8 ignore start/stop */`:** The same V8 module-scope "not-initialized" artifact that affects every module maps to line 1 of this file. `image-generator.ts` has enough branches that the 2-artifact drop is otherwise below the rounding threshold, but after other uncovered branches in the file were fixed the artifact branch at line 1 became the sole uncovered branch and pushed the file below 100%. Wrapping the import block in `/* v8 ignore start/stop */` suppresses only the artifact; all function bodies are measured normally.

### `server/src/lib/pds-region.ts` — module-scope and function-declaration branches

**Lines:** 1–4 (the opening comment lines and function declaration).

**Why suppressed with `/* v8 ignore start/stop */`:** V8's block-coverage format creates two structurally-unreachable branch ranges for every module:

1. The **module-scope "not-initialized" branch** — V8 records an implicit branch at offset 0 for "was this module's wrapper function not entered". Since Node.js always fully executes the module wrapper on import, the "not entered" arm is never taken. This maps back to the first line of the source file.
2. The **function-declaration branch** — V8 tracks whether a named function was compiled via the JIT fast-path or deferred. The "deferred/not-compiled" arm never fires for a function that is actually called. This maps to `pdsRegion(` on the `export function` line.

These branches are V8 JIT internals; no user-written test can reach them. The same artifact exists in every module but is diluted below the rounding threshold in files with many branches. In `pds-region.ts`, which has very few total branches (15), these 2 artifacts caused a visible coverage drop that failed Coveralls checks.

`/* v8 ignore start */` / `/* v8 ignore stop */` is placed around lines 1–4 (comments + function declaration) so the artifact branches are excluded. The function body (lines 6–13) is still measured normally and is fully covered.

### Server class-based modules — module-scope and class-closing-brace artifacts

**Files:** `server/src/services/auth-service.ts`, `server/src/services/profile-service.ts`, `server/src/services/settings-service.ts`

**Lines:** line 1 (module-scope artifact) and the last `}` of the class (class-declaration artifact).

**Why suppressed with `/* v8 ignore start/stop */` and `/* v8 ignore next 1 */`:** The same two V8 JIT artifact branches appear in every module. For class-based modules:

1. The **module-scope "not-initialized" branch** maps to line 1 — suppressed by `/* v8 ignore start */` as the very first line of each file, with `/* v8 ignore stop */` placed right after the constructor close so that all method bodies are still measured normally.
2. The **class-declaration branch** maps to the closing `}` of the class — suppressed by `/* v8 ignore next 1 */` placed on the line immediately before the final `}`.

These files all previously caused a visible coverage drop because the class body is small enough that 2 uncovered artifact branches crossed the rounding threshold.

### `server/src/services/notification-service.ts` — module-scope and class-closing-brace artifacts (single-line variant)

**Lines:** line 1 (module-scope artifact) and the line before the class's final `}`.

**Why suppressed with two `/* v8 ignore next 1 */` markers instead of `start/stop`:** Same two V8 JIT artifacts as the class-based modules above, but this file has several standalone exported functions (`readVapidConfig`, `isWebPushConfigured`, `createConcurrencyLimiter`) between the module-scope line and the class declaration. Wrapping `/* v8 ignore start */`...`/* v8 ignore stop */` across that whole span (as done for the pure class-based modules) would also exclude those real, tested functions from coverage. Using a single-line `/* v8 ignore next 1 */` at line 1 and another immediately before the class's closing `}` suppresses only the two artifact branches while leaving every function body (including the class methods) measured normally.

### `server/src/auth/session-agent.ts` — function-declaration artifact on `initializeAgentFromSession`

**Line:** the line immediately before `export async function initializeAgentFromSession(`.

**Why ignored:** Same V8 "function not JIT-compiled" artifact documented for `pds-region.ts` above, but affecting only the second function in this file (`initializeAgentForDid`'s declaration line does not exhibit it — the artifact does not attach to every function declaration consistently). `initializeAgentFromSession` is exercised extensively by `session-agent.test.ts`; a single `/* v8 ignore next 1 */` suppresses just the artifact branch on its declaration line.

### `server/src/auth/session-agent.ts` — blank-line/JSDoc gap between the module-scope ignore block and `initializeAgentForDid`

**Lines:** the blank line and the 8-line JSDoc comment directly above `export async function initializeAgentForDid(`.

**Why fixed by repositioning, not ignoring:** With `/* v8 ignore stop */` placed immediately after the import block (its own line, followed by a blank line and then the JSDoc comment before the function), tsx's source map attributed an uncovered statement range to those blank/comment lines even though `initializeAgentForDid` itself was fully exercised (100% branches, 100% funcs) — the same "wrong source position" class of artifact documented under "TypeScript Transpilation Artifacts" below, just severe enough here (9 of 51 lines) to visibly drop the file below 100% rather than round away. Moving `/* v8 ignore stop */` to sit directly above `export async function initializeAgentForDid(` (after the JSDoc instead of before it) closed the gap — the artifact range no longer starts mid-file on non-code lines. No test or behavior change; purely a marker-placement fix.

### `server/src/tests/*.test.ts` — module-scope artifact on the import block (per-file rollout)

**Lines:** line 1 of each affected test file (the first `import` statement).

**Why ignored (historical):** Under the former c8/Node path, `.test.ts` files were measured like any other source file (the `c8.exclude` list did not exclude `src/tests/**`), and every module exhibited a V8 module-scope "not-initialized" branch artifact mapped to line 1. `pds-region.test.ts` and `errors.test.ts` carry `/* v8 ignore start/stop */` around their imports from that era. **This rollout is moot under Bun's coverage** (#287/#288): Bun does not honor `/* v8 ignore */` at all, and `coverageSkipTestFiles = true` in `bunfig.toml` excludes test files from the report wholesale. The remaining server test files were never annotated and don't need to be — the markers would be inert.

### `server/src/tests/auth-service.test.ts` — unused `selectFrom`/`insertInto` chains in the default mock context

**Why removed (not ignored):** `makeMockCtx`'s default `db` mock included full `selectFrom(...)` and `insertInto(...)` chain stubs, but `AuthService` only ever calls `db.deleteFrom(...)` (in `deleteSession`) — `selectFrom`/`insertInto` are unused by the class entirely. Every test that exercises a code path needing `selectFrom`/`insertInto` (e.g. `checkSession`, profile creation) overrides `ctx.db.selectFrom`/`ctx.db.insertInto` with a test-specific mock, so the defaults in `makeMockCtx` were dead code — genuinely unreachable, not just under-tested. Removed rather than annotated, since they were unused scaffolding rather than a real code path.

### `server/src/tests/image-generator-generate.test.ts` — dead `try/catch` around `mock.timers.reset()`

**Why removed (not ignored):** The `afterEach` hook wrapped `mock.timers.reset()` in a `try { ... } catch { /* not enabled */ }`, defending against a hypothetical throw when mock timers were never enabled. Verified empirically that `MockTimers.reset()` does not throw in this case — it's a no-op. No test in this file ever calls `mock.timers.enable()`, so the `catch` arm was unreachable in every run. The `try/catch` was removed (and, in the #288 `bun:test` migration, the `mock.timers.reset()` call itself was dropped entirely — Bun's `mock.restore()` in `afterEach` is the cleanup, and no test in the file uses fake timers).

### `server/src/tests/message-service.test.ts` — dead table-name branch in a one-off `selectFrom` mock

**Why removed (not ignored):** The test `"respondToMessage with image uses default theme when user_settings is null"` built an inline `mockDb.selectFrom = mock.fn((table) => { if (table === "user_settings") {...} return mockSelectBuilder; })`. `MessageService.respondToMessage` only calls `db.selectFrom("user_settings")` once (to look up the image theme when `includeQuestionAsImage` is true) — it never queries any other table within that method — so the `return mockSelectBuilder` fallback for a non-matching table name was unreachable in this test. Simplified to a mock that always returns the `user_settings` shape.

### `server/src/tests/auth-service.test.ts` — `initializeAgentFromSession` in the `session-agent` module mock

**Why spread rather than stubbed (and why not simply dropped):** The `mock.module("../auth/session-agent", ...)` call in `before()` originally hand-stubbed both `initializeAgentForDid` and `initializeAgentFromSession`. The second stub was dead weight — `AuthService`, the only thing this file exercises, calls `initializeAgentForDid` directly and never touches `initializeAgentFromSession` — so it cost a permanently-uncovered function, as did the dead `if (e2e) return e2e;` branch inside the mocked `initializeAgentForDid` (unreachable because `checkSession`/`revokeSession` both check `hasE2EAgent()` before calling it). Both were removed.

Dropping the export entirely, however, made the file's correctness depend on `bun test --isolate`: Bun's `mock.module` is process-wide, so under any Bun that doesn't honour the flag the partial mock reached `session-agent.test.ts`, `message-controller.test.ts`, `profile-controller.test.ts` and `settings-controller.test.ts` and killed all four with `SyntaxError: Export named 'initializeAgentFromSession' not found` — ~80 tests silently never running. Because Bun accepts unknown flags without complaint, that failure mode is one Bun downgrade away at any time.

The mock now spreads the real module (`exports: { ...realSessionAgent, initializeAgentForDid: … }`). `initializeAgentFromSession` is then the **real** function, covered where it is actually exercised (`session-agent.test.ts`), so the mock is complete without adding an uncovered stub. `--isolate` is still passed, but it is defence in depth rather than the only thing holding the suite together.

### `server/src/tests/mock-shim.ts` and `auth-service.test.ts` tsx interop — removed (#288)

**Status: deleted / no longer applicable.** `mock-shim.ts` was the runtime-agnostic `mock` surface that bridged `node:test`'s mock API to Bun while the suite was dual-runtime; it carried a whole-file `/* v8 ignore start/stop */` because parts of its API surface existed only to match the shape, not because the suite exercised them. The `auth-service.test.ts` tsx dynamic-`import()` interop branch was a source-map artifact from `tsx`'s ESM-interop shim around `await import(...)`. Both are gone: #288 retired the dual-runtime setup, deleted `mock-shim.ts`, dropped the `tsx` loader (Bun runs TypeScript natively), and moved every test file onto `bun:test`'s native `mock`. These entries are kept as a record of why the markers existed; the markers themselves, the files they annotated, and the `c8`/Node path that honored them are all removed.

### `server/src/tests/settings-service.test.ts` — unused default `execute` mocks in `beforeEach`

**Why removed (not ignored):** `beforeEach` set `mockInsertBuilder.execute` and `mockUpdateBuilder.execute` to a default `async () => ({})` before every test, but all four call sites that exercise `createDefaultSettings`/`updateSettings` (success and failure cases) reassign `mockInsertBuilder.execute`/`mockUpdateBuilder.execute` themselves immediately before calling the service — the `beforeEach` defaults were overwritten before ever being invoked, so the two arrow functions had a permanent 0 call count. Removed the two dead assignments from `beforeEach`.

## Client — `src/sw.ts` (PWA service worker)

**Coverage:** `sw.ts` is measured like any other client module (not excluded) and is now covered by `src/tests/sw.test.ts`, which mocks `workbox-precaching`/`workbox-routing`/`workbox-strategies` and stubs the `self` global (`ServiceWorkerGlobalScope`) so the module's top-level route registrations and its `push`/`notificationclick` listeners can be imported and invoked directly in `happy-dom`, without a real service worker runtime.

### `client/src/pushPayload.ts` — excluded, type-only file

**Why excluded:** A single exported `interface PushPayload { ... }` with no runtime code — TypeScript interfaces compile away entirely, leaving zero executable statements. Same category as `src/vite-env.d.ts`.

### `client/src/index.css` — excluded, non-JS coverage artifact

**Why excluded:** Vite's CSS import handling registers the stylesheet as a coverage-tracked "module" with the v8 provider, but it has zero instrumentable statements/branches/functions (0/0 everywhere). It showed up in per-file coverage output as a spurious 0% row; excluded since there is no JavaScript to cover.

## TypeScript Transpilation Artifacts (tsx source-map gaps)

> **Historical note:** this section was written under the former c8/tsx/Node coverage path, which was retired in #288 (the server suite now runs under Bun's built-in coverage reporter, which uses neither tsx nor V8 source maps). These source-map-gap observations may no longer reproduce under Bun's reporter and are kept as a historical reference; the current server coverage limitations are documented in CLAUDE.md under "Testing & Coverage".

The following "uncovered" lines are not executable TypeScript — they are blank lines, type annotations, or closing punctuation of multi-line expressions that tsx maps back to the wrong source position. The underlying code **is** executed and tested; only V8's source-map alignment is imprecise.

| File                                      | Lines                  | Kind                                                                                                                                                                                                                                                  |
| ----------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/src/services/auth-service.ts`     | 77                     | `const cryptr = new Cryptr(secret)` in `decryptDid` — identical structure to `encryptDid` above it; tsx maps both to the same JS position                                                                                                             |
| `server/src/services/message-service.ts`  | 80, 106, 162, 297, 303 | Blank lines, TypeScript parameter-type annotations, and closing-parenthesis lines of multi-line `logger.error(...)` calls                                                                                                                             |
| `server/src/services/settings-service.ts` | 128                    | Blank line between `getUserSettings` call and `if (!existingSettings)` inside `updateSettings`                                                                                                                                                        |
| `server/src/lib/image-generator.ts`       | 144, 454–459           | TypeScript return-type annotation on `generateThemeSpecificHtml` (line 144); static CSS string content inside a multi-hundred-line template literal in `generateTwitterHtml` (lines 454–459) — V8 does not track every line within a template literal |

No `/* v8 ignore */` annotations are added for these because the underlying logic IS reached by tests; the gaps are purely a source-map rendering artefact.

### `client/src/pages/Login.tsx` — `renderActorOption` dropdown render function

**Lines:** the `renderActorOption` function body inside `LoginForm`.

**Why ignored:** `renderActorOption` is passed as `renderOption` to Mantine's `Autocomplete` component. Mantine only invokes this callback when the combobox dropdown is open and options are being rendered. In the `happy-dom` test environment, Mantine's `Combobox` never opens the dropdown: focus events do not trigger the internal `combobox.openDropdown()` state update because `happy-dom` does not fully implement the browser's focus/pointer model required by Mantine's floating-UI positioning layer. After the async fetch resolves and `data` becomes non-empty, the dropdown stays closed (no re-open is triggered), so `renderOption` is never called during any test run.

**What it would take to test:** Use Playwright (which runs against a real Chromium instance) to type in the login handle field, wait for the suggestion dropdown to appear, and assert that each option shows the avatar, display name, and `@handle` text. This is a UI-layer concern that unit tests cannot reach.

## `opengraph-service` (Go, `go test -coverprofile`)

CI (`opengraph-tests` in `.github/workflows/Tests.yml`) runs `go test -race -count=1 ./...` with no coverage flag and no threshold gate — coverage here is a local diagnostic, not an enforced bar, unlike the client's 100%-on-all-metrics gate or the server's 97%-lines gate. Go's toolchain also has no inline per-line coverage-ignore directive (no `/* v8 ignore */` or `node:coverage disable` equivalent), so gaps below are accepted and documented rather than suppressed.

Work has raised `internal/shim` package coverage from 78.8% to 95.3%, across `cache.go`, `fetcher.go`, `generate.go`, `handler.go`, `response.go`, `renderer.go`, `shim.go`, and the two engine-independent functions of `caddyproxy.go` (`IsErrServerClosed`, `proxyErrorHandler`). Remaining gaps:

- **`cache.go` — `writeFileAtomic`'s write/sync/close error branches (and the combined `if err != nil` block that depends on them).** `os.File.Write`/`.Sync`/`.Close` on a freshly-created temp file in a writable directory do not fail under normal test conditions; forcing them would need a fake/wrapped `io.Writer` (the function takes a real `*os.File` internally) or a full/quota-limited filesystem, neither portable in CI. The `CreateTemp` and `Rename` failure branches ARE tested (missing destination directory; an existing non-empty directory at the rename target, respectively).
- **`cache.go` — `writeMeta`'s `json.Marshal` failure branch.** Marshaling `struct{ MimeType string }` with a plain Go string field cannot fail; there is no invalid state reachable through `Store`'s public API that would make it error.
- **`cache.go` — `evictIfNeeded`'s `e.Info()` error branch in the second (eviction) loop.** `DirEntry.Info()` fails only on a TOCTOU race — the entry disappearing between `os.ReadDir` and the `.Info()` call — not reproducible deterministically in a single-process test.
- **`generate.go` — `Generate`'s `!ok` type-assertion guard** on the singleflight return value. `generateOnce` (the only function ever passed to `group.Do`) always returns `(GenerateResult, error)`, so the failed-assertion arm is unreachable without changing that contract. The source comment already documents this as defense against "a future refactor"; `TestGenerate_TypeAssertionGuard` exercises the happy path to confirm the guard doesn't false-positive, but cannot reach the guard itself.
- **`handler.go` — `NewHandler`'s `newCaddyProxy` error branch.** `newCaddyProxy` fails only if the process-wide embedded Caddy engine (`ensureCaddyEngine`, guarded by a `sync.Once`) fails to start. Once any test in the package successfully constructs a `Handler` (nearly all of `handler_test.go` does, via `newIntegrationHandler`), the engine is up for the rest of the test binary's life — there is no way to force a fresh failure afterward without restructuring the engine lifecycle away from `sync.Once`. The same reasoning applies to `caddyproxy.go`'s `ensureCaddyEngine` itself (its `net.Listen`/`adapter.Adapt`/`caddy.Load` failure branches) and the remainder of `newCaddyProxy` — none of these can be exercised without either forcing the _first_ engine start in the whole test binary to fail (impossible to target at just one test given `sync.Once` and Go's parallel/ordered test execution within a package) or restructuring the engine lifecycle. `IsErrServerClosed` and `proxyErrorHandler`, the two functions in `caddyproxy.go` that don't depend on the engine, are fully tested (100%) in `caddyproxy_test.go`.
- **`response.go` — `AbsoluteImageURL`'s second `if imageURL == "" { return base }` check.** This is dead code: the function's first statement already returns `""` when `imageURL == ""` (line 64-66), so by the time execution reaches line 77 `imageURL` cannot be empty. Left as-is (not deleted) since removing it is a source-behavior change outside the scope of a test-coverage pass, not a test gap to close.
- **`renderer.go` — `Render`'s `json.Marshal` failure branch.** Same reasoning as `writeMeta` above: `renderRequest{Source: htmlSrc, Format: "png", Options: map[string]any{...}}` always contains a Go string and two ints, none of which `encoding/json` can fail to marshal (invalid UTF-8 in `htmlSrc` is replaced with U+FFFD, not an error).
- **`renderer.go` — `Render`'s `if wait <= 0 { break }` branch**, distinct from the (tested) `if remaining <= 0 { break }` check earlier in the same loop iteration. Reaching it requires the retry deadline to expire specifically _during_ the `r.attempt(...)` call — after the top-of-loop check saw time remaining, but before the post-attempt wait calculation. `attempt`'s own bounded context makes this a single-digit-millisecond window that depends on OS scheduling jitter; not reliably forceable in a single-process test without also risking flaking on slower CI runners. `TestRender_ZeroWaitBudgetBreaksRetryLoop` exercises the same short-timeout-retry shape and confirms the loop still exits cleanly with `ErrRenderFailed`, without being able to pin down which of the two break points fired.
- **`shim.go` — `firstGlyph`'s `if len(r) == 0 { return "" }` check.** Dead code: the function already returns early when `strings.TrimSpace(s) == ""` (two lines above), so `[]rune(s)` on a string that passed that check can never be empty.

## `html-to-image/app.js`

This service runs on Bun (#314 — migrated from Node). CI (`html-to-image-tests` in `.github/workflows/Tests.yml`) runs `bun test app.test.js` with no coverage flag and no threshold gate — coverage here is a local diagnostic, not an enforced bar, unlike the client's 100%-on-all-metrics gate or the server's 97%-lines gate. (There is no Bun `bunfig.toml` for this service, so `bun test` reports pass/fail only unless `--coverage` is passed explicitly.) The Bun-runtime Puppeteer surface is gated instead by the **probe** (`html-to-image/probe-bun-puppeteer.mjs`), a CI canary that launches Chromium with the real `CHROMIUM_LAUNCH_ARGS` and exercises the spawn + CDP transport + screenshot round-trip — the two surfaces that were the load-bearing risk of the Node→Bun migration.

**Entry-point bootstrap block:** the `if (process.argv[1] === fileURLToPath(import.meta.url)) { ... }` block at the bottom of `app.js` (server listen + `SIGINT`/`SIGTERM` handlers) only runs when the file is executed directly, never when `app.test.js` imports it — the same rationale as excluding `server/src/index.ts` on the server side. Under Node this region was wrapped in `/* node:coverage disable */`/`/* node:coverage enable */` markers, which Node's reporter honored. Bun does **not** honor per-block coverage markers (same limitation documented for the server in #287), so the markers were removed in #314 and the gate is the import-meta path check alone — structurally unreachable under the test harness, just not suppressed from a coverage report.

**`waitForVisualReadiness`'s in-page callbacks (`page.evaluate`'s fonts-ready check, `page.waitForFunction`'s image-completeness predicate) are exercised by calling the captured function directly** in the relevant tests (`"evaluate callback waits on document.fonts.ready when present"`, `"waitForFunction predicate checks every image is complete..."`), with a fake `document` global standing in for the real page's — these functions are serialized by Puppeteer and actually execute in the browser page context, not in the Bun process, so the mock `page.evaluate`/`page.waitForFunction` in `app.test.js` only _record_ the function reference; a test has to invoke it explicitly to get real coverage and verify its logic.

**Remaining branch gap, accepted without a test:** the `browserPromise ?? startBrowser()` fallback on the final line of `getBrowser()` (the `?? startBrowser()` half) requires a concurrent caller to observe `browserPromise` as `null` at that exact point — i.e., a third overlapping `getBrowser()`/`closeBrowser()` racing in between a second caller's "someone else already relaunched" check and its own fallback read. `"a second caller racing a crash reuses the relaunch the first caller already started"` covers the more common two-way race (second caller sees the relaunch already in flight and reuses it), but forcing the three-way race deterministically would require reaching into the pool's internal timing rather than testing its public behavior. Same category as the Express generic error-handler's `err.status || 500` / `err.message || 'Internal server error'` fallbacks in `createApp` — every `next(err)` call in this file's own validation middleware always supplies both fields, so those defaults only guard against a genuinely unexpected error escaping from somewhere outside this codebase (e.g. body-parser or the rate limiter throwing a bare error) and are not reachable through this app's own code paths.

## Coverage Exclusions (via config)

The following files are excluded from coverage metrics entirely. See the root-level notes in `CLAUDE.md` under "Coverage Exclusions".

**Server** (excluded via `coveragePathIgnorePatterns` in `server/bunfig.toml`):

- `src/lexicon/**` — auto-generated AT Protocol types
- `src/index.ts` — Hono app + Bun.serve boot + signal handlers
- `src/auth/client.ts`, `src/auth/storage.ts`, `src/auth/session.ts` — OAuth wiring
- `src/auth/e2e-agent-store.ts` — in-memory Map for E2E agents; trivial code that requires a live AT Protocol PDS to exercise meaningfully
- `src/database/db.ts` — Kysely migration runner
- `src/lib/id-resolver.ts` — requires live network
- `src/lib/env.ts` — bootstrapped before tests
- `src/hono/session-middleware.ts` — signed-cookie session I/O; covered by the E2E suite (real cookies), not unit tests

**Client** (excluded via `coverage.exclude` in `vite.config.ts`):

- `src/tests/**`, `src/main.tsx`, `src/Theme.tsx` — test infra and entry point
- `src/vite-env.d.ts` — ambient declarations
- `src/styles/tokens.ts` — pure style constants
- `src/**/*.styles.ts` — per-component style modules (see below)

### Client `*.styles.ts` modules

The frontend refactor split rendering from styling: a component's CSS objects live
in a sibling `Thing.styles.ts` that the `.tsx` imports as a namespace. These files
export style constants and the pure functions that select between them
(`card({ gradient, pinned, focused })` → a `CSSProperties`), so they are the same
category as `src/styles/tokens.ts` — declarative values with no behaviour, where an
assertion could only restate the literal it is reading.

The exclusion is a glob rather than a per-file list so the convention scales, and it
carries an obligation: nothing but visual mapping may live in one. If a style
function ever needs to know a business rule, that is the signal to move the decision
back into the component or a hook, where it is measured.

**What it would take to test:** snapshot the returned objects. That would pin the
literals against themselves and fail on every deliberate visual change, which is the
noise the exclusion exists to avoid. The colours these files reference are covered
differently and more usefully — see below.

### Client theme contrast (`src/tests/theme/`)

`contrast.test.ts` is not excluded; it is the reason several of these files can be.
It parses `client/src/index.css`, resolves `var()` indirection per colour scheme, and
asserts WCAG AA on every text/background pair the UI actually renders — including
alpha-composited surfaces, every sampled point along each gradient ramp (not just the
declared stops, which is how the old cyan and emerald ask-card presets looked
compliant at 2.4:1), and every `Alert` tone against its own tint in both schemes.

It also enforces token hygiene in both directions: a declared `--nf-*` token that no
source references fails, and a referenced token that nothing declares fails. The
second direction caught `--nf-font-mono`, which two components had been asking for
without it ever having been defined.

Its helpers (`colorMath.ts`, `readTokens.ts`) live under `src/tests/` rather than
`src/lib/` because nothing ships them — they exist to check the palette, not to
render with it, so they fall under the existing `src/tests/**` exclusion.

## SQLite driver (`server/src/database/db.ts`)

`db.ts` is excluded from coverage (it's the Kysely migration runner). The SQLite driver is `bun:sqlite` (`bun:sqlite` resolves only under the Bun runtime; `@types/bun` provides its types), bridged onto Kysely's stock `SqliteDialect` via a small `BunSqliteDatabase`/`BunSqliteStatement` adapter added in #263. `better-sqlite3` (the former Node driver) was removed entirely in #288 when the Node code path was retired — there is no runtime gate left, `bun:sqlite` is used unconditionally. The adapter is exercised by the `Probe SQLite data layer` step in `.github/workflows/Tests.yml`, which runs the real `createDb` → `migrateToLatest` → insert/select path and gates on `OK`.

The two API deltas the adapter bridges (both verified locally under Bun):

- `bun:sqlite`'s `Statement` has no `reader` flag — derived as `columnNames.length > 0`, the same rule `better-sqlite3` used internally to set its `reader` flag.
- `bun:sqlite`'s `Statement.all/run/iterate` take variadic params, not an array — the adapter spreads the params array Kysely passes.

## Server test suite under `bun:test` (#269, #288; epic #268)

The server test suite runs wholesale under `bun test` — there is no Node `node --test` path, no `tsx` loader, no `c8`, and no runtime-agnostic mock shim. (The suite was previously dual-runtime: Node for the coverage baseline, Bun as a CI gate, with `server/src/tests/mock-shim.ts` bridging `node:test`'s mock API to Bun. #288 retired that setup once Bun's coverage could carry the gate — see "Coverage under Bun" below — and moved every test file onto `bun:test`'s native `mock`/`spyOn`/`mock.module`.) See CLAUDE.md "Module Mocking in Server Tests" for the current API surface and the migration notes.

### `bun run test` / `test:coverage` flags

- **`--isolate`** — Bun's `mock.module` is process-global and **not restorable** (`clearAllMocks`/`mock.restore()` clear mock call history and restore spies but do not unmock modules). `--isolate` gives each test file a fresh module registry so a file's `mock.module` (e.g. `auth-service.test.ts` mocking `session-agent`) can't leak into other files that import the real module (e.g. `session-agent.test.ts`, which tests `initializeAgentFromSession` for real). Treat it as defence in depth, not a licence to write partial module mocks — see the `auth-service.test.ts` note above about spreading the real module into the mock.
- **`--no-env-file`** — Bun auto-loads `server/.env` (which carries real VAPID keys), and `test-bootstrap.js`'s `process.env.X ||= "..."` defaults can't override already-set values. Without this flag the "VAPID not configured" notification-service test fails because the service reads `process.env` live.

### Bun version floor

`bun test` accepts unknown flags **without erroring** (still true on 1.4, re-checked in #292). `--isolate` landed in Bun 1.3.14; on an older build the flag would be dropped silently. The real floor is now **Bun 1.4**, enforced by the runtime rather than a version check: the patched `@atproto-labs/fetch-node` imports `undici_v8` statically, which throws at module load on 1.3.x (see below). The former `src/tests/assert-bun-version.js` guard was removed in #288 along with the shim, since the Bun-only suite has no second runtime to fall back to. `@types/bun` still pins `1.3.14` in `server/package.json` because `@types/bun` has published nothing for 1.4 yet — `latest` was still `1.3.14` when Bun 1.4.0 shipped. CI installs `bun-version: latest` so it keeps tracking Bun.

### Patched `@atproto-labs/fetch-node` — undici@8 + SSRF guard under Bun (#270)

`auth-controller.test.ts` and `auth-service.test.ts` (and the production server boot) transitively load `src/services/auth-service.ts` → `@atproto/oauth-client-node` → `@atproto-labs/fetch-node/dist/unicast.js` → `import { Agent } from "undici_v8"`. Two Node-isms in that file break under Bun:

1. **undici_v8 module-load crash (fixed by Bun 1.4)** — undici 8.x's `CacheStorage` constructor threw `webidl.util.markAsUncloneable is not a function` under Bun 1.3.x at module-load (the static import evaluates undici's top-level code before any version-check runs). The missing piece was `node:worker_threads.markAsUncloneable`, which Bun 1.4 implements, so `import("undici_v8")` now succeeds against the repo's resolved undici 8.9.0. The patch's lazy-import half was dropped and the static import restored; that is what makes Bun 1.4 a hard floor.
2. **`unicastFetchWrap` SSRF guard** — it requires `process.versions.undici`, which Bun does not expose (Bun implements `fetch` natively, not via undici), so it throws "Unicast SSRF protection requires Node.js 20.6+".

Item 2 is resolved by `patches/@atproto-labs%2Ffetch-node@0.3.7.patch` (applied via `patchedDependencies` in the root `package.json`, so it survives `bun install`). The patch gives `unicastFetchWrap` a Bun branch that keeps the unicast checks but applies them ahead of the request instead of via an undici dispatcher. It no longer touches the imports: the `createRequire` half that deferred `undici_v8` came out when the floor moved to Bun 1.4.

The block/pass matrix below was re-run against the re-cut patch on Bun 1.4.0. Literal loopback, private and link-local addresses are rejected as non-unicast, a DNS name resolving to loopback is rejected as "not a public domain", `file:` is rejected as an unsupported protocol, a custom dispatcher is rejected outright, and a public hostname reaches the wrapped fetch. Re-run it on any re-cut.

`@atproto-labs/fetch-node` is pinned to an exact `0.3.7` via a root `overrides` entry (rather than left to the `^0.3.5` range that `@atproto-labs/handle-resolver-node` declares) because Bun's patch matching is keyed to the exact resolved version: an unpinned range could silently re-resolve to a newer patch version on a routine `bun install`, at which point `patchedDependencies` would stop matching and the patch would silently not apply — reintroducing this crash with no error. Bumping this package requires re-cutting the patch and updating the `overrides`/`patchedDependencies` pin together.

**The Bun branch must keep enforcing the unicast rules.** An earlier revision returned Bun's native `fetch` after only the literal-IP test (`isUnicastIpHostname(url.hostname) === false`), on the reasoning that the atproto resolver only talks to well-known Bluesky endpoints. That reasoning does not hold: `isUnicastIpHostname` parses literal IPs and returns `undefined` for a DNS name, and handle resolution fetches `https://<handle>/.well-known/atproto-did` where the handle comes from whatever the user typed into the login form. Under that revision `http://internal.example.com/` — any attacker-chosen name resolving to loopback, private or link-local space — was fetched by the server. The branch now calls the package's own `unicastLookup` and rejects a hostname whose resolved addresses are not unicast, matching the Node path's error messages ("Hostname resolved to non-unicast address", "Hostname is not a public domain").

Residual difference vs. the old Node path: Node validated the address at connect time through the dispatcher's `lookup` hook, whereas Bun exposes no such hook, so the patch resolves and validates just before calling `fetch`. A name that returns a public address to the check and a private one to the connection (DNS rebinding) was caught on Node and is not on Bun. Closing that would require a connect-level hook Bun does not currently offer. (The Node path itself is gone post-#288; this note records the gap the patch was designed around.)

**The Bun branch also rejects any non-HTTP(S) scheme**, which the old Node path got for free from undici. Every unicast check is keyed on `url.hostname`, and `new URL("file:///etc/passwd").hostname` is `""`, so a `file:` URL would skip all of them — and Bun's `fetch` reads `file:` URLs where Node's refused the scheme outright (verified on Bun 1.3.14 and Node 24). Callers do validate schemes before reaching this wrapper — `validateUrl` in `@atproto/common-web` rejects DID-document `serviceEndpoint`s that aren't `http(s)://`, and `@atproto/oauth-types`' `webUriSchema` constrains authorization-server metadata to https-or-loopback — so this is a backstop for that validation regressing, not a reachable hole. It is cheap and fails closed, which is the right default for the one place in the stack whose entire job is deciding what the server is allowed to fetch.

### Coverage under Bun (#287)

Coverage comes from Bun's built-in reporter (`bun test --coverage`, configured in `server/bunfig.toml`). This replaced the former `c8`-wraps-Node baseline when the suite moved wholesale to `bun:test` (#288). Three accepted limitations, all verified on Bun 1.3.14 and re-checked unchanged on 1.4.0, documented as the trade-off for measuring coverage on the production runtime rather than a second one:

1. **Bun does not honor `/* v8 ignore */` source annotations.** A block wrapped in `/* v8 ignore start */.../* v8 ignore stop */` still shows as uncovered; the whole-file marker the former `mock-shim.ts` relied on is invisible too. Per-file exclusion is therefore done via `coveragePathIgnorePatterns` globs in `bunfig.toml` (mirroring the old `c8.exclude` list). The repo's ~45 in-source `v8 ignore` markers were almost all branch-only suppressions (V8 JIT module-scope artifacts, class-closing-brace artifacts, unreachable guards); since Bun's lcov carries no branch data (see #2), dropping them cost essentially nothing on the metrics Bun measures. One file (`src/lib/image-generator.ts`) briefly dropped from 100% to 99.17% lines when its outer `catch (imgErr)` block (lines 168-169) — previously suppressed by an (inert-under-Bun) `/* v8 ignore next 4 */` — started showing as uncovered. It turned out to be genuinely reachable rather than structurally dead (see the corrected note above); adding a real test for it restored the file to 100% lines / 100% functions.
2. **Bun's lcov carries line + function coverage only — no branch data.** The lcov has `DA` (per-line) and `FNF`/`FNH` (function totals) records but zero `BRDA`/`BRF`/`BRH` branch records. Coveralls therefore reports the server flag's branch coverage as 0/N/A. The Coveralls `coverage-threshold-percent: 97` is consequently the coverage gate on its own, tolerating the missing branch metric.
3. **`coverageThreshold` is unusable, so none is set.** Any value makes the run exit 1 whenever coverage is below 100%, whatever the threshold says (verified on 1.3.14 at `0` with 98%, and on 1.4.0 at `0.97` with 99.59%). The per-metric object form (`{ lines = ..., functions = ... }`) is worse still — it silently no-ops. CLI flags like `--coverage-threshold=` are not honored either; the setting only reads from `bunfig.toml`.

### The server suite went ungated for one release, and how

Setting a `coverageThreshold` meant `bun run test:coverage` always exited 1, so the CI step carried `continue-on-error: true` plus a `Fail if tests failed` step keyed on `steps.server-tests.outcome`. Neither worked. The step body piped through `tee` without `set -o pipefail`, so the step's exit status was always `tee`'s `0` — the outcome was never `failure`, the guard never fired, and the `continue-on-error` was moot. Any failing server test reported green.

That is how #380 merged with `auth-service.test.ts` asserting `/network down/` against a `checkSession` it had just wrapped in `withRetry`, which throws `Call failed after 3 attempts` instead. The suite was red on `main` on both 1.3.14 and 1.4.0 and CI said otherwise.

Fixed by removing the threshold (limitation 3 above), which lets the exit code track test results, then dropping `continue-on-error` and the dead guard step and adding `set -o pipefail`. The Coveralls gate is unchanged and still bars a coverage drop.

## Client suite under the Bun runtime

The client has no Node dependency left. Every script (`dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `test:watch`, `test:coverage`) routes through `bunx --bun`, and `start` was already `bun serve.ts`. Verified by shimming `node` on `PATH` to `exit 127` and running all of them; each passes. The `Client Tests` CI job sets up Bun and no Node, and runs probe -> build -> `test:coverage`. All 545 tests pass.

The explicit `--bun` flag is the load-bearing part. `bun run <script>` hands a node-shebang binary to Node whenever Node is on `PATH`, and `vite`, `vitest`, `tsc`, and `oxlint` all have one:

```
$ bun run rtprobe          -> runtime: node v22.22.2
$ bun run --bun rtprobe    -> runtime: bun 1.3.11
```

Before this, `docker/Dockerfile.client` (`FROM oven/bun`, no Node in the image) was the only place Vite ran under Bun, and nothing tested it.

### Coverage: istanbul, because v8 needs an API Bun lacks

`@vitest/coverage-v8` calls `Profiler.startPreciseCoverage` through `node:inspector`. Bun does not implement it:

```
Error: Coverage APIs are not supported
 > #handleMethod node:inspector:93:15
 > startCoverage @vitest/coverage-v8/dist/index.js:17:16
```

Every worker throws, the run finishes in ~6s instead of ~20s, and the summary reports `0% (0/1228)` with 36 unhandled errors. The dangerous part is that the test count still passes, so a job that only gates on tests goes green while measuring nothing.

`@vitest/coverage-istanbul` instruments the source at transform time and needs no V8 inspector, so it runs on either runtime. It is now the only provider; `@vitest/coverage-v8` was removed from `client/package.json`.

The gate did not get weaker:

|                     | v8 (before, on Node)     | istanbul (now, on Bun)                                |
| ------------------- | ------------------------ | ----------------------------------------------------- |
| statements          | 100% (1228/1228)         | 100% (1246/1246)                                      |
| branches            | 100% (937/937)           | 100% (952/952)                                        |
| functions           | 100% (380/380)           | 100% (382/382)                                        |
| lines               | 100% (1146/1146)         | 100% (1160/1160)                                      |
| enforced by         | Coveralls threshold only | `coverage.thresholds` in `vite.config.ts` + Coveralls |
| lcov branch records | yes                      | yes (`BRDA`)                                          |

istanbul's denominators are larger because it instruments defensive branches v8 folds away. Reaching 100% on them was annotation work, not new tests: 29 sites were uncovered on the first istanbul run, and all 29 already carried a `/* v8 ignore */` marker that istanbul does not honor. See "Coverage Suppression Markers" above for the conversion and for the placement rule that bit two of them.

Two side benefits worth noting. The thresholds are now enforced in-repo rather than only by Coveralls, and they were verified to bite: deleting one `/* istanbul ignore if */` drops statements to 99.91% and `test:coverage` exits 1. And unlike the server's Bun-native coverage, istanbul's lcov carries real `BRDA` records, so the Coveralls branch metric for the `client` flag is meaningful.

### Why not Bun's built-in coverage

`bun test --coverage` (what the server uses) only measures code run by Bun's own test runner. The client suite is Vitest with happy-dom, `@testing-library/react`, and MSW, so using it would mean porting 545 tests across 36 files off Vitest. Not worth it to avoid an npm dependency, and it would be a step down on metrics: Bun's lcov has no branch data at all, and its `coverageThreshold` has a bug where it exits 1 for any coverage below 100% regardless of the configured value, which is why the server sets none (see "Coverage under Bun" above).

### `zod` named exports through Vitest's module runner

`client/src/pages/Login.tsx` imports zod as `import * as z from "zod"`. The named form (`import { z } from "zod"`) fails under Bun with `TypeError: undefined is not an object (evaluating 'z.string')`, taking down `Login.test.tsx` and `AppLayout.test.tsx`.

Zod v4's entrypoint does `import * as z from "./v4/classic/external.js"; export { z }`, and Vite's dependency prebundle preserves that shape as `export { external_exports as z }` alongside ~400 ordinary named exports. Under Bun, reading `z` off that module gives `undefined` while every sibling export resolves. `Object.keys()` on the namespace shows `$brand`, `$input`, and no `z`.

Isolating the layer, since the fix belongs at the narrowest one:

| path                                 | Node        | Bun               |
| ------------------------------------ | ----------- | ----------------- |
| `import("zod")` directly             | `z` present | `z` present       |
| `viteServer.ssrLoadModule("zod")`    | `z` present | `z` present       |
| Vitest module runner (happy-dom env) | `z` present | **`z` undefined** |

Only the last combination breaks, so this is Vitest's module runner over the prebundled dependency on Bun, not Bun's ESM loader and not Vite's transform. The namespace import is the form zod's own docs use, costs nothing, and sidesteps it. The regression guard is CI running the suite on Bun: reverting to `import { z }` fails it immediately. The probe script deliberately does not assert this, since a bare `import("zod")` inside the probe passes on both runtimes and would give false assurance.

### Playwright is the one Node holdout

Everything in the repo runs on Bun except Playwright, which keeps `actions/setup-node` in `E2E.yml` and plain `playwright test` in the root scripts.

The runner itself is not the problem. `bunx --bun playwright test --list` works on a trivial spec:

```
$ bunx --bun playwright test --list e2e/_min.spec.ts
  [setup] > auth.setup.ts:7:0 > authenticate via e2e bypass
  [chromium] > _min.spec.ts:2:0 > min
Total: 2 tests in 2 files
```

Our real specs do not build. Four of the nine fail, and they are exactly the four that use an inline `type` import (`import { test, expect, type Page } from "@playwright/test"`); the five using a plain value import all pass:

```
AggregateError: 2 errors building "e2e/web/customise.spec.ts"
AggregateError: 2 errors building "e2e/web/inbox.spec.ts"
AggregateError: 2 errors building "e2e/web/profile-send-message.spec.ts"
AggregateError: 2 errors building "e2e/mobile/navigation.spec.ts"
Total: 0 tests in 0 files
```

Splitting the inline `type` into its own `import type` statement removes one of the two errors per file, leaving an opaque `BuildMessage {}` with no message. Playwright swallows the underlying error, and `DEBUG=pw:test:*` surfaces only `error in "load tests": Error: No tests found`. `bun build --target=bun e2e/web/customise.spec.ts` transpiles the same file with no complaint, so this is the Playwright loader interacting with Bun's transpiler, not Bun's TypeScript support.

Not worth pursuing. Microsoft does not support Bun as a Playwright runtime, the errors are opaque by design, and there is nothing to gain: E2E drives a real browser against the built Docker images, so the runner's own runtime has no bearing on what is under test. Leave it on Node.

### Remaining Node in the repo

| Location                    | What                      | Why it stays          |
| --------------------------- | ------------------------- | --------------------- |
| `.github/workflows/E2E.yml` | `actions/setup-node@v4`   | Playwright, see above |
| root `package.json`         | `test:e2e`, `test:e2e:ui` | Playwright, same      |

That is the whole list. Every other script in every workspace routes through `bunx --bun` or is Bun-native, all five Dockerfiles are `FROM oven/bun`, and `Tests.yml` sets up no Node in any job. The `tsx` loader was dropped from `server/` (Bun runs the lexicon-publishing script's TypeScript directly) and the html-to-image CI job now uses `bunx puppeteer browsers install chrome` instead of `npx`.

### Remaining questions

- The zod interop bug is unreported upstream. Worth a minimal repro against Vitest or Bun, since the namespace import is a workaround rather than a fix.
- `probe-bun-vite.mjs` asserts the runtime for the dev server only. If someone drops `--bun` from a single script, that script silently reverts to Node without failing anything. A `[run] bun = true` in a `client/bunfig.toml` would close that gap at the config level; not done here to keep the mechanism visible in the scripts.
