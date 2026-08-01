# Testing Notes

This document explains coverage exclusions and hard-to-test code.

## `/* v8 ignore */` Usage

### `client/src/utils/parseRichText.tsx` — `toShortUrl` long-URL truncation branch

**Lines:** the `if (href.length > 80) { return href.slice(0, 76) + "…"; }` block inside `toShortUrl`.

**Why ignored:** This branch only fires when `safeUrlParse` returns `null` **and** the URL is longer than 80 characters. `safeUrlParse` returns `null` only for non-http/https protocols (e.g., `ftp://`, `javascript:`). The AT Protocol (Bluesky) only stores `http://` and `https://` links in rich text facets, so this path is structurally unreachable via the `@atcute/bluesky-richtext-parser` tokenizer used by `parseRichText`.

**What it would take to test:** Mock or swap the tokenizer to inject a fake link segment whose `url` field is a non-http protocol string of more than 80 characters (e.g., `ftp://` + `a`.repeat(75)). Alternatively, export `toShortUrl` and test it directly.

### `server/src/services/auth-service.ts` — `agent.getProfile()` block in `checkSession`

**Status: now tested.** This block was previously ignored because `node:test`'s `mock.module()` was unavailable under the CJS `tsx` transform. After the ESM migration (#216) it became reachable: `auth-service.test.ts` mocks `../auth/session-agent` via `mock.module()` (registered in a `before()` hook before dynamically importing `auth-service`) so `initializeAgentForDid` returns a fake agent whose `getProfile` is controlled per-test. The block now has full coverage (success path, `!data` branch, optional-field fallbacks, getProfile rejection). See the `checkSession` tests for the pattern.

### `client/src/Navigation.tsx` — unreachable `null` tail of friends ternary

**Line:** the trailing `: null` in `{friendsLoading ? ... : friends.length > 0 ? ... : !friendsLoading ? ... : null}`.

**Why ignored:** This `null` branch is structurally unreachable. The outer ternary only reaches the `else` arm when `friendsLoading` is falsy; at that point the inner guard `!friendsLoading` is always `true`, so the final `null` can never be evaluated at runtime.

**What it would take to test:** Not possible through React rendering — the branch requires `friendsLoading` to be simultaneously falsy (to skip the loading skeleton) and truthy (to skip the empty-state text).

### `client/src/components/AppHeader.tsx` — unreachable `did === activeDid` guard in `handleSwitch`

**Line:** `if (did === activeDid || isSwitching) return;` inside `handleSwitch` (the account-switcher's `UserMenu`).

**Why ignored:** The `Menu.Item` for the currently-active account is rendered with `disabled={isActive || isSwitching}`, and Mantine/JSDOM do not dispatch click events to disabled buttons. `handleSwitch` can therefore only ever be invoked with `did !== activeDid` through the UI, making the `did === activeDid` arm of the guard permanently unreachable in tests. It's kept in the source as defense-in-depth in case the disabled state and the handler ever fall out of sync.

**What it would take to test:** Call `handleSwitch` directly (bypassing the disabled menu item) by exporting it or via a component ref, with `did` equal to `activeDid`.

### `client/src/components/AppHeader.tsx` — `handleSwitch` catch block that resets `body.style`

**Lines:** the `catch { document.body.style.pointerEvents = ""; document.body.style.opacity = ""; }` block inside `handleSwitch` (the account-switcher's `UserMenu`).

**Why ignored:** Same pattern as the `onLogout` catch block already documented in `CLAUDE.md`'s `/* v8 ignore next */` convention — the `try` only assigns string literals to `document.body.style`, which never throws in practice. Note: a `/* v8 ignore next 4 */` placed on the line before `} catch {` did **not** suppress this block (the two assignment lines still showed as uncovered) even though the identical pattern worked for the `onLogout` handler a few lines above. Switching to `/* v8 ignore start */` immediately before `} catch {` and `/* v8 ignore stop */` immediately after the closing `}` reliably suppresses the whole block.

**What it would take to test:** Not worth pursuing — would require mocking `document.body.style` property assignment to throw, which doesn't reflect any real browser behavior.

### `client/src/pages/Customise.tsx` — unreachable `null` fallback in the locale `Select`'s `onChange`

**Line:** `touchpointLocale: value || null` inside the "Message language" `Select`'s `onChange` handler.

**Why ignored:** Mantine's `Select` `onChange` signature is typed to allow `value: string | null`, but `null` is only ever passed when the currently-selected option is deselected, which requires `allowDeselect` (or `clearable`) to be enabled. This `Select` is rendered with `allowDeselect={false}` and no clear affordance, so every `onChange` reachable through the rendered UI carries one of the non-empty locale codes from `touchpointLocales` — `value` is always truthy in practice. The `|| null` exists to satisfy the handler's declared parameter type, not to handle a reachable UI state.

**What it would take to test:** Call the `Select`'s `onChange` prop directly (bypassing rendering) with `null`, e.g. by extracting the handler to a named, exported function, or by asserting on the prop passed to a mocked `Select`.

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

**Lines:** the top-level `catch (imgErr)` in `generateQuestionImage`.

**Why ignored:** This catch wraps the entire image generation pipeline. The inner operations (sharp, fetch) are individually testable and their failure paths are exercised in the test suite. The outer catch would only fire if something unexpected escaped all inner error handling — a structurally unlikely scenario given the current code paths are all covered. The `/* v8 ignore next 4 */` annotation covers all four lines of the block (the `} catch {` opener, the `logger.error` call, the `return {}`, and the closing `}`).

**What it would take to test:** Inject a mock for `sharp` that throws synchronously at the import level, or export an internal function whose throw can be observed before the outer catch suppresses it.

### `server/src/lib/image-generator.ts` — `imageGenerator` exported object closing brace

**Line:** the `};` closing of `export const imageGenerator = { generateQuestionImage, };`.

**Why ignored:** V8 records an implicit branch for the "object literal not initialised" path at the last punctuation of a module-level `const` export. Since the module is always fully executed on import, this arm is never taken — the same JIT artifact as the class-closing-brace pattern in class-based modules, but manifesting on the exported object literal instead.

**What it would take to test:** Not possible — this is a V8 JIT internal; no user-written test can exercise the "object not initialised" branch.

### `server/src/lib/image-generator.ts` — `LOGO_DATA_URL` ternary false branch in `generateTwitterHtml`

**Line:** the `"NF"` false branch of `LOGO_DATA_URL ? \`<img src="${LOGO_DATA_URL}" ... />\` : "NF"` inside the HTML template literal.

**Why ignored:** `LOGO_DATA_URL` is a module-level constant populated by reading and base64-encoding the logo PNG at import time. It is always a non-empty string when the module loads successfully; the `"NF"` fallback is a dead code path under any realistic execution. V8 counts each arm of the ternary as a branch, so the false arm shows as uncovered.

**What it would take to test:** Mock the `fs.readFileSync` call at module load time to return an empty buffer (so `LOGO_DATA_URL` becomes `""`), then re-import the module. This requires `mock.module` wrapping the Node.js `fs` module before the dynamic import of `image-generator.ts`.

### `client/src/utils/parseRichText.tsx` — `safeUrlParse` null return after catch

**Line:** the `return null;` statement that follows the try-catch in `safeUrlParse`.

**Why ignored:** `return null` is reachable only if `new URL(fullHref)` throws an exception inside the try block. In practice, `toShortUrl` is always called with hrefs that have already been prefixed with `https://` by the calling code in `parseRichText`, so the URL constructor never throws. A URL with a non-http/https protocol also cannot reach this return — the code prepends `https://` for any non-http/https input, ensuring the parsed protocol is always `https:`.

**What it would take to test:** Export `toShortUrl` and call it directly with a string that causes `new URL` to throw (e.g., a string containing whitespace after the https:// prefix).

### `client/src/utils/parseRichText.tsx` — unknown segment type fallback in `parseRichText`

**Line:** the `result.push(segment.text || segment.raw)` fallback at the end of the `forEach` loop.

**Why ignored:** The `@atcute/bluesky-richtext-parser` tokenizer only produces `text`, `mention`, and `link` segment types per the AT Protocol spec. The three explicit `if` branches above it cover all reachable segment types, making this fallback structurally dead code.

**What it would take to test:** Mock the `tokenize` function to inject a fake segment with an unknown type.

### `client/src/utils/parseRichText.tsx` — protocol-prefix guard for auto-detected domain links

**Line:** `if (!/^https?:\/\//.test(href)) { href = "https://" + href; }` inside the `text`-segment auto-linking loop in `parseRichText`.

**Why ignored:** `matchText` comes from `domainRegex`, whose domain-segment pattern (`(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}`) requires a literal `.` immediately before the TLD. `http:` and `https:` contain no `.` before their `:`, so the regex engine can never start a match there — verified empirically (`domainRegex.exec("https://example.com/path")` returns `"example.com/path"`, never including the scheme). `matchText` is therefore always a bare domain, so the guard's "already has a protocol" false arm is structurally unreachable.

**What it would take to test:** Not possible through `parseRichText`'s public behavior — would require calling the auto-linking logic directly with a hand-crafted `matchText` that already includes a scheme, bypassing the regex that makes this guard necessary in the first place.

### `client/src/api/messageService.ts` — disabled-query reject branch in `useMessages`

**Line:** the `Promise.reject("No DID provided")` inside `useMessages`'s `queryFn`.

**Why ignored:** Same pattern as `profileService.ts` — `enabled: !!did` prevents React Query from calling `queryFn` when `did` is null. This reject branch is a structural guard that can never fire through normal React Query flow.

**What it would take to test:** Same approach as `profileService.ts` — call `refetch()` on the hook rendered with a null argument; React Query v5 invokes `queryFn` regardless of `enabled` on explicit refetch.

### `client/src/pages/PublicProfile.tsx` — defensive max-length guard in `handleSend`

**Lines:** lines 86–89 (`if (message.length > MAX_MESSAGE_LENGTH) { setFormError(...); return; }`).

**Why ignored:** The `<Textarea>` component's `onChange` handler unconditionally rejects any value longer than `MAX_MESSAGE_LENGTH` (`if (e.target.value.length <= MAX_MESSAGE_LENGTH) setMessage(...)`). As a result, the React `message` state can never exceed the limit through the UI, making the `handleSend` guard permanently unreachable in practice.

**What it would take to test:** Export `handleSend` for direct unit testing, or access the component's internal state setter to bypass the `onChange` guard. Neither is practical without refactoring the component.

### `client/src/utils/parseRichText.tsx` — false branch of `if (!/^https?:\/\//.test(href))`

**Line:** 117 (`if (!/^https?:\/\//.test(href)) { href = "https://" + href; }`) inside the `text` segment branch of the `forEach` loop.

**Why uncovered:** This branch is entered when the regex matches a domain-like string in a plain-text segment (e.g., `example.com`). The domain regex `((?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}...)` cannot match strings that start with `https?://` because the `://` breaks the allowed character set. So the `false` branch — "href already has https:// protocol, skip prepend" — is structurally unreachable: every domain match that enters this code path will always lack the protocol.

**What it would take to test:** There is no DOM path to exercise the false branch because the tokenizer's domain regex logically excludes protocol-prefixed strings. Testing it would require either mocking the regex or exporting the inner text-processing logic.

### `client/src/pages/Messages.tsx` — collapsed reply Box/Button handlers (correction to a prior note)

A previous version of this note claimed the collapsed `↩ Reply` Box's `stopPropagation` handler and the collapsed Button's `onClick` body were uncovered due to a Vitest/v8 source-map alignment bug with arrow functions nested in the non-first branch of a JSX ternary. That diagnosis was wrong. The real cause: `screen.getAllByRole("button", { name: /reply/i })` matches **both** the outer message-card `<Paper role="button">` (whose aggregated accessible name includes the nested "↩ Reply" text) **and** the actual nested `<button>` element. `.find((b) => b.textContent?.includes("↩"))` picked the first DOM-order match, which is the outer Paper card — so those "collapsed button" tests were actually clicking the card itself (which has its own unguarded `onClick` that produces the same visible outcome), never the real nested Box/Button. Querying with an **exact** name match (e.g. `screen.getAllByRole("button", { name: "↩ Reply" })`, exact matching excludes the Paper since its full accessible name is longer) or `document.querySelectorAll("button")` reliably isolates the real element and exercises these handlers normally — no ignore annotation or tooling workaround is needed. See `Messages.test.tsx` for the corrected tests ("collapsed reply Box wrapper stops click propagation…", "collapsed reply Button (exact match) opens the response box…", "collapsed reply Button does nothing when blocked…").

### `client/src/pages/Messages.tsx` — six structurally-unreachable defensive guards

**Lines (as of this writing):** `handleDeleteRequest`'s `if (threadRootTid === tid) return;`; `handleConfirmDelete`'s `if (messageIdToDelete) performDelete(...)`; `handlePrepareResponse`'s `if (idx !== -1) setFocusedCardIndex(idx);`; the `if (el) setTimeout(...)` in the respondingTid scroll-into-view `useEffect`; the `newestCard ?? messagesTopRef.current` fallback plus its `if (target)` guard in the auto-scroll `useEffect`; and the `if (idx !== -1) messageCardRefs.current[idx]?.focus();` in the global Escape-key handler.

**Why ignored:** All six are defensive guards whose "unhappy" arm can never be reached given the app's actual call graph:
- `handleDeleteRequest`'s guard duplicates a check the trash `ActionIcon`'s `onClick` already performs (`if (isPinned) return;`) before ever calling the handler — by the time `handleDeleteRequest` runs, `threadRootTid === tid` is already known false.
- `handleConfirmDelete`'s guard: `messageIdToDelete` is always set in the same state update that opens the confirmation modal, and the only element that invokes this handler (the modal's Confirm button) doesn't exist in the DOM unless the modal is open.
- `handlePrepareResponse`'s `idx` lookup: every call site passes a `tid` taken directly from a `sortedMessages` entry (the same array being searched), so the entry is always found.
- The scroll-into-view effect's `el` lookup: `respondingTid` is only ever set (via `handlePrepareResponse`) to the tid of a card that is already rendered in the same commit, so `document.getElementById` always finds it.
- The auto-scroll effect's `newestCard` lookup: whenever the guarding `messages?.[0]` check passes, that message's card is rendered in the same commit, so `newestCard` is always truthy, making both the `??` fallback and the `if (target)` guard's false arm dead.
- The Escape-key handler's `idx` lookup: same reasoning as `handlePrepareResponse` — `respondingTid` always corresponds to a `sortedMessages` entry.

Each is annotated in place with `/* v8 ignore start */` / `/* v8 ignore stop */` around just the guard statement, following this file's established convention, plus an inline comment explaining the reachability argument.

**What it would take to test:** Each would require calling the relevant internal function directly with an argument that violates the invariant enforced by its sole caller (e.g. a `tid` not present in `sortedMessages`, or firing the modal's `onConfirm` with `messageIdToDelete` forced to `null`) — not reachable by driving the rendered UI, since every caller already enforces the invariant before invoking these functions.

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

**Files:** `server/src/services/auth-service.ts`, `server/src/controllers/message-controller.ts`, `server/src/controllers/profile-controller.ts`, `server/src/controllers/settings-controller.ts`, `server/src/services/profile-service.ts`, `server/src/services/settings-service.ts`

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

The following "uncovered" lines are not executable TypeScript — they are blank lines, type annotations, or closing punctuation of multi-line expressions that tsx maps back to the wrong source position. The underlying code **is** executed and tested; only V8's source-map alignment is imprecise.

| File | Lines | Kind |
|------|-------|------|
| `server/src/services/auth-service.ts` | 77 | `const cryptr = new Cryptr(secret)` in `decryptDid` — identical structure to `encryptDid` above it; tsx maps both to the same JS position |
| `server/src/services/message-service.ts` | 80, 106, 162, 297, 303 | Blank lines, TypeScript parameter-type annotations, and closing-parenthesis lines of multi-line `logger.error(...)` calls |
| `server/src/services/settings-service.ts` | 128 | Blank line between `getUserSettings` call and `if (!existingSettings)` inside `updateSettings` |
| `server/src/lib/image-generator.ts` | 144, 454–459 | TypeScript return-type annotation on `generateThemeSpecificHtml` (line 144); static CSS string content inside a multi-hundred-line template literal in `generateTwitterHtml` (lines 454–459) — V8 does not track every line within a template literal |

No `/* v8 ignore */` annotations are added for these because the underlying logic IS reached by tests; the gaps are purely a source-map rendering artefact.

### `client/src/pages/Login.tsx` — `renderActorOption` dropdown render function

**Lines:** the `renderActorOption` function body inside `LoginForm`.

**Why ignored:** `renderActorOption` is passed as `renderOption` to Mantine's `Autocomplete` component. Mantine only invokes this callback when the combobox dropdown is open and options are being rendered. In the `happy-dom` test environment, Mantine's `Combobox` never opens the dropdown: focus events do not trigger the internal `combobox.openDropdown()` state update because `happy-dom` does not fully implement the browser's focus/pointer model required by Mantine's floating-UI positioning layer. After the async fetch resolves and `data` becomes non-empty, the dropdown stays closed (no re-open is triggered), so `renderOption` is never called during any test run.

**What it would take to test:** Use Playwright (which runs against a real Chromium instance) to type in the login handle field, wait for the suggestion dropdown to appear, and assert that each option shows the avatar, display name, and `@handle` text. This is a UI-layer concern that unit tests cannot reach.

## `opengraph-service` (Go, `go test -coverprofile`)

CI (`opengraph-tests` in `.github/workflows/Tests.yml`) runs `go test -race -count=1 ./...` with no coverage flag and no threshold gate — coverage here is a local diagnostic, not an enforced bar, unlike the client's 100%-on-all-metrics gate or the server's 97%-lines gate. Go's toolchain also has no inline per-line coverage-ignore directive (no `/* v8 ignore */` or `node:coverage disable` equivalent), so gaps below are accepted and documented rather than suppressed.

Work so far has raised `internal/shim` package coverage from 78.8% to 92.6% (`cache.go`, `fetcher.go`, `generate.go`, `handler.go`, `response.go` — `caddyproxy.go`, `renderer.go`, `shim.go` not yet done). Remaining gaps in the five files touched:

- **`cache.go` — `writeFileAtomic`'s write/sync/close error branches (and the combined `if err != nil` block that depends on them).** `os.File.Write`/`.Sync`/`.Close` on a freshly-created temp file in a writable directory do not fail under normal test conditions; forcing them would need a fake/wrapped `io.Writer` (the function takes a real `*os.File` internally) or a full/quota-limited filesystem, neither portable in CI. The `CreateTemp` and `Rename` failure branches ARE tested (missing destination directory; an existing non-empty directory at the rename target, respectively).
- **`cache.go` — `writeMeta`'s `json.Marshal` failure branch.** Marshaling `struct{ MimeType string }` with a plain Go string field cannot fail; there is no invalid state reachable through `Store`'s public API that would make it error.
- **`cache.go` — `evictIfNeeded`'s `e.Info()` error branch in the second (eviction) loop.** `DirEntry.Info()` fails only on a TOCTOU race — the entry disappearing between `os.ReadDir` and the `.Info()` call — not reproducible deterministically in a single-process test.
- **`generate.go` — `Generate`'s `!ok` type-assertion guard** on the singleflight return value. `generateOnce` (the only function ever passed to `group.Do`) always returns `(GenerateResult, error)`, so the failed-assertion arm is unreachable without changing that contract. The source comment already documents this as defense against "a future refactor"; `TestGenerate_TypeAssertionGuard` exercises the happy path to confirm the guard doesn't false-positive, but cannot reach the guard itself.
- **`handler.go` — `NewHandler`'s `newCaddyProxy` error branch.** `newCaddyProxy` fails only if the process-wide embedded Caddy engine (`ensureCaddyEngine`, guarded by a `sync.Once`) fails to start. Once any test in the package successfully constructs a `Handler` (nearly all of `handler_test.go` does, via `newIntegrationHandler`), the engine is up for the rest of the test binary's life — there is no way to force a fresh failure afterward without restructuring the engine lifecycle away from `sync.Once`.
- **`response.go` — `AbsoluteImageURL`'s second `if imageURL == "" { return base }` check.** This is dead code: the function's first statement already returns `""` when `imageURL == ""` (line 64-66), so by the time execution reaches line 77 `imageURL` cannot be empty. Left as-is (not deleted) since removing it is a source-behavior change outside the scope of a test-coverage pass, not a test gap to close.

## Coverage Exclusions (via config)

The following files are excluded from coverage metrics entirely. See the root-level notes in `CLAUDE.md` under "Coverage Exclusions".

**Server** (excluded via `--test-coverage-exclude` in `package.json`):
- `src/lexicon/**` — auto-generated AT Protocol types
- `src/index.ts` — Express boot + signal handlers
- `src/auth/client.ts`, `src/auth/storage.ts`, `src/auth/session.ts` — OAuth wiring
- `src/auth/e2e-agent-store.ts` — in-memory Map for E2E agents; trivial code that requires a live AT Protocol PDS to exercise meaningfully
- `src/database/db.ts` — Kysely migration runner
- `src/lib/id-resolver.ts` — requires live network
- `src/lib/env.ts` — bootstrapped before tests
- `src/routes.ts`, `src/routes/*.ts` — pure Express wiring (includes `e2e-auth-routes.ts`)

**Client** (excluded via `coverage.exclude` in `vite.config.ts`):
- `src/tests/**`, `src/main.tsx`, `src/Theme.tsx` — test infra and entry point
- `src/vite-env.d.ts` — ambient declarations
- `src/styles/tokens.ts` — pure style constants

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

`bun test` accepts unknown flags **without erroring**. `--isolate` landed in Bun 1.3.14; on an older build the flag would be dropped silently. `@types/bun` is pinned to `1.3.14` in `server/package.json` as the version floor (the former `src/tests/assert-bun-version.js` guard was removed in #288 along with the shim, since the Bun-only suite has no second runtime to fall back to — an incompatible local Bun now fails at the test run itself rather than via a pre-check). CI installs `bun-version: latest` so it keeps tracking Bun.

### Patched `@atproto-labs/fetch-node` — undici@8 + SSRF guard under Bun (#270)

`auth-controller.test.ts` and `auth-service.test.ts` (and the production server boot) transitively load `src/services/auth-service.ts` → `@atproto/oauth-client-node` → `@atproto-labs/fetch-node/dist/unicast.js` → `import { Agent } from "undici_v8"`. Two Node-isms in that file break under Bun:

1. **undici_v8 module-load crash** — undici 8.x's `CacheStorage` constructor throws `webidl.util.markAsUncloneable is not a function` under Bun 1.3.x at module-load (the static import evaluates undici's top-level code before any version-check runs). Not fixed in any undici 8.x (verified through 8.9.0); not fixable by upgrading Bun (already latest) or `@atproto-labs/fetch-node` (already latest 0.3.5).
2. **`unicastFetchWrap` SSRF guard** — it requires `process.versions.undici`, which Bun does not expose (Bun implements `fetch` natively, not via undici), so it throws "Unicast SSRF protection requires Node.js 20.6+".

Both are resolved by `patches/@atproto-labs%2Ffetch-node@0.3.5.patch` (applied via `patchedDependencies` in the root `package.json`, so it survives `bun install`). The patch: (a) removes the top-level `undici_v8` import and loads it lazily via `createRequire` only on the Node-26 v8 branch (never reached under Bun); (b) gives `unicastFetchWrap` a Bun branch that keeps the unicast checks but applies them ahead of the request instead of via an undici dispatcher.

**The Bun branch must keep enforcing the unicast rules.** An earlier revision returned Bun's native `fetch` after only the literal-IP test (`isUnicastIpHostname(url.hostname) === false`), on the reasoning that the atproto resolver only talks to well-known Bluesky endpoints. That reasoning does not hold: `isUnicastIpHostname` parses literal IPs and returns `undefined` for a DNS name, and handle resolution fetches `https://<handle>/.well-known/atproto-did` where the handle comes from whatever the user typed into the login form. Under that revision `http://internal.example.com/` — any attacker-chosen name resolving to loopback, private or link-local space — was fetched by the server. The branch now calls the package's own `unicastLookup` and rejects a hostname whose resolved addresses are not unicast, matching the Node path's error messages ("Hostname resolved to non-unicast address", "Hostname is not a public domain").

Residual difference vs. the old Node path: Node validated the address at connect time through the dispatcher's `lookup` hook, whereas Bun exposes no such hook, so the patch resolves and validates just before calling `fetch`. A name that returns a public address to the check and a private one to the connection (DNS rebinding) was caught on Node and is not on Bun. Closing that would require a connect-level hook Bun does not currently offer. (The Node path itself is gone post-#288; this note records the gap the patch was designed around.)

**The Bun branch also rejects any non-HTTP(S) scheme**, which the old Node path got for free from undici. Every unicast check is keyed on `url.hostname`, and `new URL("file:///etc/passwd").hostname` is `""`, so a `file:` URL would skip all of them — and Bun's `fetch` reads `file:` URLs where Node's refused the scheme outright (verified on Bun 1.3.14 and Node 24). Callers do validate schemes before reaching this wrapper — `validateUrl` in `@atproto/common-web` rejects DID-document `serviceEndpoint`s that aren't `http(s)://`, and `@atproto/oauth-types`' `webUriSchema` constrains authorization-server metadata to https-or-loopback — so this is a backstop for that validation regressing, not a reachable hole. It is cheap and fails closed, which is the right default for the one place in the stack whose entire job is deciding what the server is allowed to fetch.

### Coverage under Bun (#287)

Coverage comes from Bun's built-in reporter (`bun test --coverage`, configured in `server/bunfig.toml`). This replaced the former `c8`-wraps-Node baseline when the suite moved wholesale to `bun:test` (#288). Two accepted limitations, both verified on Bun 1.3.14 and documented as the trade-off for measuring coverage on the production runtime rather than a second one:

1. **Bun does not honor `/* v8 ignore */` source annotations.** A block wrapped in `/* v8 ignore start */.../* v8 ignore stop */` still shows as uncovered; the whole-file marker the former `mock-shim.ts` relied on is invisible too. Per-file exclusion is therefore done via `coveragePathIgnorePatterns` globs in `bunfig.toml` (mirroring the old `c8.exclude` list). The repo's ~45 in-source `v8 ignore` markers were almost all branch-only suppressions (V8 JIT module-scope artifacts, class-closing-brace artifacts, unreachable guards); since Bun's lcov carries no branch data (see #2), dropping them cost essentially nothing on the metrics Bun measures. One file (`src/lib/image-generator.ts`) dropped from 100% to 99.17% lines — its outer `catch (imgErr)` block (lines 168-169) was previously suppressed by `/* v8 ignore next 4 */` and now shows as uncovered. It's a structurally-unreachable catch wrapping the whole image pipeline (all inner failure paths are individually tested) and stays well above the 97% threshold, so the file is not excluded. The aggregate is 99.95% lines / 100% functions.
2. **Bun's lcov carries line + function coverage only — no branch data.** The lcov has `DA` (per-line) and `FNF`/`FNH` (function totals) records but zero `BRDA`/`BRF`/`BRH` branch records. Coveralls therefore reports the server flag's branch coverage as 0/N/A. The real gate is Bun's own `coverageThreshold = 0.97` (scalar form — the object form `{ lines, functions }` silently no-ops on 1.3.14; the scalar form reliably fails the run below threshold); the Coveralls `coverage-threshold-percent: 97` is a secondary line-of-coverage defense that tolerates the missing branch metric.

The `coverageThreshold` is set as a scalar (`0.97`) rather than the per-metric object form because the object form (`{ lines = ..., functions = ... }`) silently no-ops on Bun 1.3.14 — the run does not fail even when below threshold — whereas the scalar form reliably exits non-zero. CLI flags like `--coverage-threshold=` are also not honored; the threshold must live in `bunfig.toml`.
