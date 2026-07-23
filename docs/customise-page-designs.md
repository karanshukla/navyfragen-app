# `/customise` page — design exploration

> Companion to **#273** (the functional scaffold). This is the "design TBD"
> half that #273 deliberately deferred. Nothing here is built into the app yet —
> it's a decision aid so we can pick a layout before the five dependent issues
> start dropping cards onto the page.
>
> **Interactive mockups:** open [`customise-mockups/index.html`](./customise-mockups/index.html)
> in a browser. It reproduces the real app chrome (header + nav) and lets you
> flip between the three designs and light/dark, using the actual `--nf-*`
> tokens from `client/src/index.css`.

## The constraint

Match the existing app. The whole app is already a coherent Mantine system —
cream page / lavender cards in light, void / glass cards in dark, `royal`
primary, 14px card radius, Inter throughout, `SettingsCard` as the repeating
unit. The `/customise` page should look like it has always been part of that
system, not like a redesign. Every design below is built from
`SettingsCard` + the existing tokens; they differ only in **how the cards are
arranged**, not in what a card looks like.

## Why `/customise` exists as its own page (and isn't just more of Settings)

`Settings` is about *your account and the app* — install, PDS sync, push
notifications, the feed, delete-my-data. It's plumbing.

Every setting routed to `/customise` by the open issues is about *what other
people experience when they interact with you*:

| Issue | Setting | Who it affects |
|-------|---------|----------------|
| #199 | Custom profile prompt (replaces "Send X an anonymous message") | Visitors to your public profile |
| #266 | Touchpoint language (profile strings + share payload) | Visitors + your audience |
| #177 | Inbox on/off | People trying to send you a message |
| #58 | Profanity filter | Messages you receive |
| #192 | Notification preferences (only if it grows granular toggles) | You |

Four of the five change what a *stranger* sees or is allowed to do. That's the
page's identity: **"how your inbox presents itself to the world."** The
designs below lean into that framing to varying degrees.

## Feature inventory (the cards every design has to hold)

Each is a `user_settings` column + a control. Controls, per issue:

1. **Custom prompt** (#199) — `TextInput` / small `Textarea`, nullable, max ~100
   chars, placeholder = the current default string. The heaviest control (needs
   a label, char counter, save affordance) — the one that makes a pure uniform
   grid look uneven.
2. **Inbox open/closed** (#177) — `Switch`. When off, the public profile shows a
   "not accepting messages" state instead of the send form. High-signal, so it
   wants a slightly louder treatment than a checkbox in a row.
3. **Profanity filter** (#58) — `Switch` + an unresolved **reject vs. mask**
   decision. Shown here as a `SegmentedControl` revealed when the switch is on,
   so the mockup carries the open question visibly rather than hiding it.
4. **Touchpoint language** (#266) — `Select` (`en` + 2–3 real locales). Defaults
   to English/current strings when unset.
5. **Notification preferences** (#192) — conditional. Only lands here if #192
   picks "granular per-type toggles" (option b). Shown as a card with
   new-message / reply / daily-digest switches, clearly marked as the optional
   one. The existing single Enable/Disable button stays on Settings regardless.

---

## Design A — Uniform grid (mirror Settings exactly)

The literal reading of #273: one `Grid`, equal-height `SettingsCard`s, 3-up on
`lg` / 2-up on `md` / 1-up on `base` — the same `Grid.Col span={{ base: 12, md:
6, lg: 4 }}` the Settings page already uses. Each feature is one card. A
dependent issue adds a `Grid.Col` and is done.

**Pros**
- Zero new patterns. Pixel-consistent with Settings; nothing to review but copy.
- Exactly the scaffold #273 describes — "an empty `Grid` a dependent issue can
  add a `Grid.Col`/`SettingsCard` to without touching layout."
- Lowest risk, fastest to land.

**Cons**
- The custom-prompt card (text field + counter) and the profanity reject/mask
  control are visually heavier than a lone `Switch`, so the grid looks uneven —
  the exact thing `SettingsCard`'s `flexGrow` description was meant to smooth
  over works less well when the *controls* differ in height, not just the copy.
- No grouping. As the five issues land, it's five unlabelled cards in reading
  order with no signal about which affect your public profile vs. your inbox.
- Reads as a second Settings page. Doesn't answer "why is this separate?"

**Verdict:** the safe default. Ship this if we want the page to exist with the
least possible surface area and sort out hierarchy later.

---

## Design B — Grouped sections *(recommended)*

Same cards, same `SettingsCard`, but organised under two or three labelled
sections that encode *who each setting affects*:

- **Your public profile** — custom prompt (#199), language (#266)
- **Message intake** — inbox open/closed (#177), profanity filter (#58)
- **Notifications** — granular toggles (#192), only if that issue grows them

A section is a small uppercase dimmed eyebrow (`Text` `tt="uppercase"` `fw={600}`
`c="dimmed"`) + a one-line helper, then a `Grid` of that section's cards. No new
visual vocabulary — just typographic hierarchy the app already uses (the nav
"Moots / Following / Oomfs" headers are the same device).

The custom-prompt card leads its section at a wider span (`md: 12` or `lg: 8`)
so the text field has room, which also resolves Design A's uneven-height
problem — heavy controls sit in wide cards, toggles sit in narrow ones.

**Pros**
- Gives the page a distinct identity from Settings without a single new token.
- Scales cleanly: the five dependent issues each land in an obvious section
  instead of appending to one flat list; the page stays legible at 8+ settings.
- The grouping *is* the argument for why `/customise` is its own page.
- Still just `SettingsCard`s — a dependent issue adds a `Grid.Col` to the right
  section; only marginally more than Design A.

**Cons**
- Slightly more scaffolding than #273's "one empty `Grid`" — the page ships with
  labelled section containers, and a dependent issue picks a section (a one-line
  decision, but a decision).
- Section labels are copy that needs to be owned/reviewed.

**Verdict:** the recommendation. Same building blocks and risk profile as A,
but the page earns its separate existence and won't sprawl as issues land.

---

## Design C — Controls + live public-profile preview

Design B's grouped controls in a left column; a **sticky live preview of the
public-profile ask-card** in a right column. Because #199 (prompt), #266
(language) and #177 (inbox on/off) all change *exactly what a visitor sees*, the
preview renders the real ask-card (reusing `PublicProfile.tsx`'s gradient
`--nf-grad-mark` card) and updates as you type the prompt, pick a language, or
toggle the inbox closed — turning three abstract settings into "this is what a
stranger will actually see."

On mobile it collapses to one column with the preview pinned to the top (or
behind a "Preview" toggle).

**Pros**
- Highest clarity for the profile-facing settings — the ones that matter most,
  since they're customer-facing acquisition copy. You edit the thing and watch
  the real artifact change.
- Reinforces the page identity ("how your inbox presents itself") more strongly
  than any label can.
- Still built from existing pieces — the ask-card already exists; this extracts
  it into a shared presentational component and feeds it draft settings.

**Cons**
- Most build effort: requires factoring the ask-card out of `PublicProfile.tsx`
  into a reusable, prop-driven component (worth doing anyway, but it's real work
  and needs its own tests).
- The preview only meaningfully reflects the profile-facing subset. Profanity
  filter (#58) and notification prefs (#192) don't visibly change the ask-card,
  so those cards sit below the split with no preview — a slight asymmetry.
- New layout pattern (two-column sticky) not used elsewhere in the app; more to
  get right responsively.

**Verdict:** the ambitious option. Best experience for the profile-facing
settings; only worth it if we're willing to extract the ask-card component and
accept that profanity/notifications don't participate in the preview.

---

## Recommendation

Ship **Design B**. It matches the app exactly, costs essentially the same as the
minimal Design A, gives the page a reason to be separate from Settings, and
scales as the five issues land. Keep **Design C's preview** on the table as a
follow-up enhancement scoped to the profile-facing cards (#199/#266/#177) once
the ask-card is extracted — it layers on top of B without redoing it.

Design A remains the fallback if we want the absolute smallest change and are
willing to revisit hierarchy later.

## Notes for whoever implements the chosen design

- Reuse `SettingsCard` (`client/src/components/SettingsCard.tsx`) unchanged for
  every card; pass the control as `children` exactly like Settings does.
- Follow the Settings auth-gate (`Settings.tsx:90-93`) and `Title` pattern for
  the page shell, per #273.
- Persist via the existing `useUpdateUserSettings` mutation
  (`settingsService.ts`); each new setting is a `Partial<UserSettings>` field,
  same as `pdsSyncEnabled`/`imageTheme`.
- Two open product questions block full implementation, not the layout choice:
  #58's reject-vs-mask behaviour and #192's "what does *better* mean" — the
  mockups surface both rather than assume an answer.
- Nav icon on `/customise` is still a placeholder per #273 (`IconAdjustments`
  used in the mockup); not a design decision.
