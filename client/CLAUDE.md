# Client (`client/`)

## Runtime: Bun, no Node

**The client needs no Node.** Every script (`dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `test:watch`, `test:coverage`) routes through `bunx --bun`, and `start` was already `bun serve.ts`. Verified by shimming `node` on `PATH` to `exit 127` and running all of them.

The explicit `--bun` flag is load-bearing: `bun run <script>` hands a node-shebang binary — and `vite`, `vitest`, `tsc`, and `oxlint` all have one — to Node whenever Node is on PATH, so a bare `bun run build` silently runs on Node locally while running on Bun inside `docker/Dockerfile.client` (which is `FROM oven/bun` and ships no Node). Before this, that production build path was the only place Vite ran under Bun, and nothing tested it.

`bunfig.toml` sets `[run] bun = true` so the guarantee survives a script that forgets the flag: a new `"foo": "vite something"` would otherwise run on Node locally and Bun in Docker, failing nothing. The explicit `bunx --bun` in the scripts stays anyway, since it reads at the call site and still applies when a script is invoked from outside `client/`. `server/bunfig.toml` carries the same setting. The repo root deliberately does not, because `test:e2e` must stay on Node.

`probe-bun-vite.mjs` (`bun run probe:bun`) is the canary, gating the `Client Tests` CI job the way the server's SQLite/OAuth probes gate theirs. It asserts the runtime really is Bun and boots the Vite dev server to fetch a transformed TSX route — the dev server being the one Vite surface neither `vite build` nor Vitest touches.

## Data Layer

React Query is the data layer. Each domain (auth, messages, profile, settings) has a service file in `src/api/` that exports plain functions and React Query hooks:

- `src/api/apiClient.ts` — thin fetch wrapper; reads `VITE_API_URL` env var (defaults to `""`, so same-origin)
- `src/api/authService.ts` — exports `useSession`, `useLogin`, `useLogout`
- `src/api/messageService.ts`, `profileService.ts`, `settingsService.ts` — similar pattern

All API calls use `credentials: "include"` for cookie forwarding.

### Form Validation

The client uses **Zod v4** (`^4.4.3`). Zod v4 has breaking syntax changes from v3:

- Import it as `import * as z from "zod"`, never `import { z }` (see below)
- Custom messages on `.min()` / `.max()` use `{ error: "..." }` instead of a plain string
- Validation errors are accessed via `.issues` not `.errors`

**Import `zod` as a namespace, never `import { z }`.** Zod v4's entrypoint re-exports its own namespace (`import * as z from "./v4/classic/external.js"; export { z }`), and Vite's dependency prebundle preserves that as `export { external_exports as z }`. Reading that one binding under Bun yields `undefined` while every other named export resolves, so `z.string()` throws at module scope and takes the whole suite file down with it. A plain `import("zod")` under Bun is fine, and so is Vite's `ssrLoadModule("zod")` — it only surfaces through Vitest's module runner, which is why running the suite on Bun in CI is what guards it.

### UI Feedback (Toast Notifications)

Transient feedback (success, error) uses Mantine's `showNotification()` from `@mantine/notifications` rather than inline alert state. The `<Notifications>` component is mounted in `src/main.tsx` with `position="bottom-right"` and `autoClose={5000}`. Use `showNotification()` for any new transient messages — don't add stateful alert components to pages.

## Styling

### Rendering and styling are separate files

A `.tsx` describes structure and behaviour; the CSS objects it needs live in a
sibling `*.styles.ts`, imported as `import * as styles from "./Thing.styles"`.
Anything computed from props is a small named function there
(`card({ gradient, pinned, focused })`), not a ternary inline in JSX. Style
modules are excluded from coverage — they are constants and the pure functions
that pick between them, with no behaviour an assertion could pin. Do not let
logic drift into one: if a "style" function needs to know a business rule, the
rule belongs in the component or a hook.

### Design Tokens

`client/src/index.css` is the single source of truth for colour, and it is
layered — components may only read from the last two layers:

1. **Brand primitives** (`--nf-royal`, `--nf-grad-mark`, …) — scheme-independent
   raw palette. Referenced only by the semantic layer in the same file.
2. **Semantic tokens** (`--nf-surface`, `--nf-link`, `--nf-nav-active-bg`, …) —
   named for the job. Light values on `:root`, dark overrides under
   `:root[data-mantine-color-scheme="dark"]`. **This is why no component calls
   `useComputedColorScheme` to choose a colour** — the browser picks. If you find
   yourself adding an `isDark` prop, add a token instead.
3. **On-gradient tokens** (`--nf-on-grad`, `--nf-on-grad-muted`,
   `--nf-on-grad-accent`) — deliberately _not_ scheme-aware, because the brand
   gradients are dark in both schemes. `--nf-on-grad-faint` is for rules and
   progress tracks; it is not strong enough for text and a test pins that.

`src/styles/tokens.ts` gives these TypeScript handles so a renamed token is a
compile error rather than a colour that silently resolves to nothing.

Gradient usage:

- `--nf-grad-mark` — the primary brand gradient; use it for every interactive
  card background (login, ask, inbox hero, gradient question cards)
- `--nf-grad-dark` — reserved for the "default" image-export theme preview; not a
  UI surface
- ask-card presets (`aurora`/`ember`/`verdant`) are curated so white text clears
  AA across the whole ramp — check `contrast.test.ts` before changing a stop

Nav active state uses a solid tint (`--nf-nav-active-bg`) — no gradients on nav
items. Gradient text (`background-clip: text`) is used only in the `Wordmark`.

### Overriding a Mantine variable

Mantine declares its scheme variables at `:root[data-mantine-color-scheme="…"]`
(specificity 0,2,0). A bare `[data-mantine-color-scheme="…"]` block loses to it
and silently does nothing — which is what had happened to the light-mode
`--mantine-color-body` and `--mantine-color-default-border` overrides. Match the
selector exactly, and only for variables the provider does not re-emit at
runtime: `--mantine-color-body` comes from `theme.white` / `dark[7]`, and brand
text colours come from `--nf-accent-text` / `--nf-link` rather than fighting the
provider's `--mantine-color-*-text`.

### Contrast is enforced, not reviewed

`src/tests/theme/contrast.test.ts` parses `index.css`, resolves the tokens, and
fails if any documented text/background pair drops below WCAG AA — including
across the full ramp of every gradient, both colour schemes, and every `Alert`
tone against its own tint. It also fails on a declared `--nf-*` token nothing
references and on a referenced token nothing declares, so the palette cannot
accumulate dead entries or typos.

## Testing & Coverage

Run coverage from `client/`:

```bash
bun run test:coverage
```

The client targets **100% across all four metrics** (statements, lines, branches, functions) via Vitest's **istanbul** provider, enforced by `coverage.thresholds` in `vite.config.ts` (verified to exit non-zero at 99.91%) plus the Coveralls threshold.

**Why istanbul and not v8.** `@vitest/coverage-v8` drives `node:inspector`'s Profiler domain, which Bun does not implement — every worker throws `Error: Coverage APIs are not supported` and the run reports 0% while still exiting green on the test count. istanbul instruments the source at transform time and needs no V8 inspector, so it works on either runtime. `@vitest/coverage-v8` is no longer a dependency. A side benefit: istanbul's lcov carries real `BRDA` branch records, so unlike the server's Bun coverage the Coveralls branch metric is meaningful.

### `/* istanbul ignore */` Convention

Suppress unreachable code with istanbul's markers. `/* v8 ignore */` is inert under the istanbul provider and there are none left in `src/`; do not reintroduce them.

Pick the narrowest form:

- `/* istanbul ignore if */` — the `if` body is unreachable (a defensive early-return guard whose condition can't hold)
- `/* istanbul ignore else */` — the implicit else is unreachable (a guard that always passes)
- `/* istanbul ignore next */` — the whole next statement or function, for `catch` blocks wrapping non-throwing DOM operations and for callbacks tests never invoke

Use them **only** for:

1. `catch {}` blocks that wrap non-throwing DOM operations (e.g. the AppHeader `handleSwitch` catch that resets `body.style` — the try never throws in practice)
2. TypeScript-narrowed union branches, and UI guards, that are structurally unreachable at runtime

Do **not** use them to skip real business logic. Document any usage in `docs/testing-notes.md`.

**Placement matters.** istanbul attaches hints to statement-, function-, and `if`-level nodes only. A marker in front of a bare sub-expression is silently ignored, so `foo: /* istanbul ignore next */ value || null` does nothing — hoist the expression into a statement and mark that instead. Two sites here (`Customise.tsx`'s locale `onChange`, `profileService.ts`'s `initialDataUpdatedAt`) were rewritten into block bodies for exactly this reason.

### Coverage Exclusions

Excluded via `coverage.exclude` in `vite.config.ts`:

- `src/tests/**`, `src/main.tsx`, `src/Theme.tsx` — test infra and app entry point
- `src/vite-env.d.ts` — ambient declarations
- `src/styles/tokens.ts` — pure style constant exports
- `src/**/*.styles.ts` — per-component style modules, same rationale
- `src/pushPayload.ts` — a type-only `interface` with no runtime code to execute
- `src/index.css` — a stylesheet; Vite's CSS import handling registers it as a coverage-tracked module with zero instrumentable statements

Adding a new exclusion requires a comment in `docs/testing-notes.md` explaining why and what it would take to test.
