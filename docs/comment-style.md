# Comment style: the four rungs before prose

The root `CLAUDE.md` carries the rule in short form. This file is the long-form
rationale and the worked examples.

A comment is the last resort, not the first. Work down this ladder and only write
prose when all four rungs fail.

## 1. Abstraction and encapsulation

Business logic explained by a comment in a controller belongs in a domain-named
service method instead. Arithmetic spelled out in a comment (`// 360px minus 32px
body padding minus 36px bubble padding`) belongs in named constants that compute
it. A repeated coercion explained in two places belongs in one named helper
(`fromDbBoolean`, `toDbBoolean`).

## 2. Human-readable subfunctions

A comment labelling a block (`// Phase 2: cache lookup`, `// --- POST /login ---`)
means the block wants to be a function, or the line below already says it. Name it
and delete the label. Sentinel values get names too: `USE_APP_DEFAULT` beats
`null // = use the default`.

## 3. Unit tests that pin the rule, on both sides of its boundary

A comment stating a business rule is a rule nothing enforces. Replace it with a
pair of tests, one inside the boundary and one outside, named after the rule. A cap
of five messages per inbox becomes "accepts a fifth message" and "rejects a sixth
message", not `// max 5 per inbox`. The pair is the point: a single happy-path test
documents a case, whereas the pair documents the limit and fails the day someone
moves it. A comment goes stale silently.

## 4. Integration/E2E tests for rules that only exist across a boundary

Same idea one level up. A rule that only shows up end to end (cookie format,
account switching, a settings round-trip clearing a field) gets a spec, not a
paragraph above the code.

## 5. Whatever 1–4 can't reach

Hidden constraints, upstream bugs, production-incident history, protocol
requirements, reachability arguments for coverage suppressions. These stay, but
keep them tight: state the constraint, not its biography.

Tests augment the rule rather than merely restating it: the rule becomes
executable, and the boundary that prose only asserted is now enforced. What is left
over after the rule is pinned (a threat model, an incident, an upstream bug) is
rung 5 and can stay, but it should be the residue, not the rule written twice.

## Point at the test that carries the rule

When rung 3 or 4 is what replaced a comment, leave a link to the test so the rule
stays findable from the code it governs. Both toolchains resolve these, so use the
native form:

- **TypeScript**: a markdown link in JSDoc, path relative to the file. VS Code
  renders it clickable on hover:
  ```ts
  /**
   * @see [ttl-cache.test.ts](../tests/ttl-cache.test.ts): pins expiry, the
   * eviction order, and the bound.
   */
  ```
- **Go**: a doc link to the test function. Tests are in the same package, so gopls
  resolves `[TestName]`:
  ```go
  // [TestFileCache_LoadDoesNotRefreshTTL] and [TestFileCache_LoadByPathUpdatesLRURecency]
  // pin both directions.
  ```

Say which rule the test pins, not just that one exists. A bare `@see` is noise.

`bun run check:doc-links` (run in CI by the `Doc Links` job in `Tests.yml`) fails on
a relative markdown link in any TS/JS comment whose file is missing, and on a Go
`[TestName]` doc link with no matching `func TestName`. Without it a renamed test
rots the link silently, which is the same staleness problem the comment had.

The markdown side deliberately does not require the `@see` tag to be adjacent:
JSDoc wraps, so the tag and the link often sit on different lines, and an earlier
tag-anchored version of the checker passed a wrapped link that pointed at nothing.
`bun run test:doc-links` pins that case and the rest of the checker's boundaries.

## What this does not license

Go doc comments on exported identifiers stay (idiomatic, and gopls/`go doc` surface
them). Coverage pragmas (`/* istanbul ignore */`, `coveragePathIgnorePatterns`
rationale in `bunfig.toml`) stay. `docs/testing-notes.md` remains the long-form home
for every suppression argument; code comments should link to it rather than restate
it.
