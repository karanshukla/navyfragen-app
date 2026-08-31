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

1. **Brand primitives** — scheme-independent raw values, in three groups.
   - _1a, the brand palette_ (`--ds-primary`, `--ds-ink`, `--ds-highlight`, …) — the
     hues a repaint replaces. **Nothing outside `index.css` may reference one**, and
     `contrast.test.ts` fails on any file that does. Reaching for `var(--ds-primary)`
     in a component means the colour needs a semantic token; add one here.
   - _1b, the brand gradients_ (`--ds-grad-mark`, the ask-card presets) — components
     read these directly; a gradient is a single design decision, not a hue.
   - _1c, structural primitives_ (`--ds-font-sans`, `--ds-ease`, `--ds-dur-*`,
     `--ds-radius-*`) — carry no colour and no restriction.
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

## Repainting the brand

Colour lives in three places. The first two are checked against each other; the
third is a separate service and cannot be, so it is the one to remember:

1. `client/src/index.css`, layer 1a — the `--ds-*` palette. The layer-1b gradients
   and the `rgba()` tints in layer 2 spell their channels out rather than
   referencing a palette token, so they need editing too; they are at least all in
   this one file, and `grep -n 'rgba(' client/src/index.css` lists them.
2. `client/src/Theme.tsx` — Mantine's `MantineColorsTuple`s, which cannot be CSS
   variables because Mantine derives hover, light and outline variants from literal
   values, along with `white`, `black` and the `ALERT_TONES` channel triplets.
3. `opengraph-service/internal/shim/template.go` — the share-card renderer mirrors
   the palette in Go constants (`ogGradMark`, `ogText`, …). It is a different
   language in a different service, so nothing can pin it against the stylesheet;
   its own tests check that the card stays legible, not that it still matches the
   app. A repaint that skips it leaves every shared link wearing the old brand.

The second is a copy of the first, so `contrast.test.ts` pins every shared shade:
change a hex in one and the suite names the token that no longer agrees. Work
outward from layer 1a — semantic tokens resolve through it, and no component names
a hue at all, so nothing below the palette should need editing.

Palette entries are named for the job they do (`primary`, `accent`, `ink`,
`highlight`, `danger`), not the hue they currently hold, so a repaint changes
values and leaves every name and call site alone. Two things intentionally keep a
hue name: `PROFILE_CARD_GRADIENTS.royal` is a persisted user setting rather than a
palette entry, and the comment on the `danger` tuple quotes the old
`color="crimson"` because it records why that spelling was a bug.

The suite is the acceptance test for a repaint: contrast pairs are re-checked at
WCAG AA, so a hue that reads well on white and badly on the dark surface fails
before it ships.

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
