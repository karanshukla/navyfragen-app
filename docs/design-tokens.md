# Design tokens and styling rules (client)

`client/CLAUDE.md` carries the rules in short form. This file is the reasoning.

## Rendering and styling are separate files

A `.tsx` describes structure and behaviour; the CSS objects it needs live in a
sibling `*.styles.ts`, imported as `import * as styles from "./Thing.styles"`.
Anything computed from props is a small named function there
(`card({ gradient, pinned, focused })`), not a ternary inline in JSX. Style modules
are excluded from coverage — they are constants and the pure functions that pick
between them, with no behaviour an assertion could pin. Do not let logic drift into
one: if a "style" function needs to know a business rule, the rule belongs in the
component or a hook.

## The three token layers

`client/src/index.css` is the single source of truth for colour, and it is layered —
components may only read from the last two layers:

1. **Brand primitives** (`--ds-primary`, `--ds-grad-mark`, …) — scheme-independent raw
   palette. Referenced only by the semantic layer in the same file.
2. **Semantic tokens** (`--ds-surface`, `--ds-link`, `--ds-nav-active-bg`, …) — named
   for the job. Light values on `:root`, dark overrides under
   `:root[data-mantine-color-scheme="dark"]`. **This is why no component calls
   `useComputedColorScheme` to choose a colour** — the browser picks. If you find
   yourself adding an `isDark` prop, add a token instead.
3. **On-gradient tokens** (`--ds-on-grad`, `--ds-on-grad-muted`,
   `--ds-on-grad-accent`) — deliberately _not_ scheme-aware, because the brand
   gradients are dark in both schemes. `--ds-on-grad-faint` is for rules and progress
   tracks; it is not strong enough for text and a test pins that.

`src/styles/tokens.ts` gives these TypeScript handles so a renamed token is a compile
error rather than a colour that silently resolves to nothing.

## Gradient usage

- `--ds-grad-mark` — the primary brand gradient; use it for every interactive card
  background (login, ask, inbox hero, gradient question cards)
- `--ds-grad-dark` — reserved for the "default" image-export theme preview; not a UI
  surface
- ask-card presets (`aurora`/`ember`/`verdant`) are curated so white text clears AA
  across the whole ramp — check `contrast.test.ts` before changing a stop

Nav active state uses a solid tint (`--ds-nav-active-bg`) — no gradients on nav
items. Gradient text (`background-clip: text`) is used only in the `Wordmark`.

## Overriding a Mantine variable

Mantine declares its scheme variables at `:root[data-mantine-color-scheme="…"]`
(specificity 0,2,0). A bare `[data-mantine-color-scheme="…"]` block loses to it and
silently does nothing — which is what had happened to the light-mode
`--mantine-color-body` and `--mantine-color-default-border` overrides. Match the
selector exactly, and only for variables the provider does not re-emit at runtime:
`--mantine-color-body` comes from `theme.white` / `dark[7]`, and brand text colours
come from `--ds-accent-text` / `--ds-link` rather than fighting the provider's
`--mantine-color-*-text`.

## Contrast is enforced, not reviewed

`src/tests/theme/contrast.test.ts` parses `index.css`, resolves the tokens, and fails
if any documented text/background pair drops below WCAG AA — including across the full
ramp of every gradient, both colour schemes, and every `Alert` tone against its own
tint. It also fails on a declared `--ds-*` token nothing references and on a
referenced token nothing declares, so the palette cannot accumulate dead entries or
typos.
