# Client (`client/`)

Runs entirely on Bun, no Node anywhere — every script routes through `bunx --bun`
(`docs/runtime-notes.md` for why the flag is load-bearing).

## Data layer

React Query. Each domain (auth, messages, profile, settings) has a service file in
`src/api/` exporting plain functions plus React Query hooks — `apiClient.ts` is a thin
fetch wrapper reading `VITE_API_URL` (defaults to `""`, same-origin). All API calls
use `credentials: "include"`.

## Form validation (Zod v4)

- **Import it as `import * as z from "zod"`, never `import { z }`** — the named
  binding resolves to `undefined` under Bun and takes the whole suite file down at
  module scope (`docs/runtime-notes.md`).
- Custom messages on `.min()` / `.max()` take `{ error: "..." }`, not a plain string.
- Validation errors are on `.issues`, not `.errors`.

## UI feedback

Transient feedback uses Mantine's `showNotification()` from `@mantine/notifications`
— `<Notifications>` is mounted in `src/main.tsx` (`position="bottom-right"`,
`autoClose={5000}`). Don't add stateful alert components to pages.

## Styling

Rules; reasoning in `docs/design-tokens.md`.

- **Structure and style are separate files.** A `.tsx` holds structure and
  behaviour; its CSS objects live in a sibling `*.styles.ts` (`import * as styles
  from "./Thing.styles"`). Anything computed from props is a named function there,
  not an inline ternary. If a style function needs a business rule, the rule belongs
  in the component or a hook.
- **`src/index.css` is the single source of truth for colour**, in three layers:
  brand primitives → semantic tokens (`--nf-surface`, `--nf-link`, …) → on-gradient
  tokens (`--nf-on-grad*`, deliberately not scheme-aware). Components read only from
  the last two.
- **No component calls `useComputedColorScheme` to choose a colour** — light values
  sit on `:root`, dark under `:root[data-mantine-color-scheme="dark"]`, and the
  browser picks. Reaching for an `isDark` prop means you want a token.
- Overriding a Mantine scheme variable requires matching
  `:root[data-mantine-color-scheme="…"]` exactly; a bare attribute selector loses on
  specificity and silently does nothing.
- `src/tests/theme/contrast.test.ts` fails on any documented pair below WCAG AA, and
  on any `--nf-*` token that is declared-but-unused or used-but-undeclared.

## Testing & coverage

```bash
bun run test:coverage   # run from client/
```

100% on all four metrics (statements, lines, branches, functions) via Vitest's
**istanbul** provider, enforced by `coverage.thresholds` in `vite.config.ts` plus the
Coveralls threshold. (v8 coverage cannot work under Bun — `docs/runtime-notes.md`.)

### `/* istanbul ignore */` convention

`/* v8 ignore */` is inert under istanbul; there are none left in `src/` and none
should be reintroduced. Pick the narrowest form: `ignore if` (unreachable `if` body),
`ignore else` (guard that always passes), `ignore next` (whole statement or
function).

Use them **only** for `catch {}` blocks wrapping non-throwing DOM operations, and
for TypeScript-narrowed union branches or UI guards that are structurally
unreachable. Never to skip real business logic. Document every use in
`docs/testing-notes.md`.

**Placement matters**: istanbul attaches hints to statement-, function-, and
`if`-level nodes only, so a marker in front of a bare sub-expression
(`foo: /* istanbul ignore next */ value || null`) does nothing — hoist it into a
statement first.

### Coverage exclusions

`coverage.exclude` in `vite.config.ts`: `src/tests/**`, `src/main.tsx`,
`src/Theme.tsx` (test infra and entry point), `src/vite-env.d.ts` (ambient),
`src/styles/tokens.ts` and `src/**/*.styles.ts` (style constants),
`src/pushPayload.ts` (type-only), `src/index.css` (stylesheet Vite registers as a
module with no instrumentable statements).

Adding an exclusion requires an entry in `docs/testing-notes.md` explaining why and
what it would take to test.
