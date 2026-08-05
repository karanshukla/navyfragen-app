# Client (`client/`)

React Query is the data layer. Each domain (auth, messages, profile, settings) has a service file in `src/api/` that exports plain functions and React Query hooks:
- `src/api/apiClient.ts` — thin fetch wrapper; reads `VITE_API_URL` env var (defaults to `""`, so same-origin)
- `src/api/authService.ts` — exports `useSession`, `useLogin`, `useLogout`
- `src/api/messageService.ts`, `profileService.ts`, `settingsService.ts` — similar pattern

All API calls use `credentials: "include"` for cookie forwarding.

### Form Validation

The client uses **Zod v4** (`^4.4.3`). Zod v4 has breaking syntax changes from v3:
- Custom messages on `.min()` / `.max()` use `{ error: "..." }` instead of a plain string
- Validation errors are accessed via `.issues` not `.errors`

### UI Feedback (Toast Notifications)

Transient feedback (success, error) uses Mantine's `showNotification()` from `@mantine/notifications` rather than inline alert state. The `<Notifications>` component is mounted in `src/main.tsx` with `position="bottom-right"` and `autoClose={5000}`. Use `showNotification()` for any new transient messages — don't add stateful alert components to pages.

### Design Tokens

Brand CSS custom properties live in `client/src/index.css` under the `--nf-*` namespace and are the single source of truth for colors and gradients. Key gradient tokens:

- `--nf-grad-mark` — the primary brand gradient (`#3349E0 → #6B3FD4 → #4F1FA6`); use this for all interactive card backgrounds (login, ask, inbox hero, question cards with gradient enabled)
- `--nf-grad-dark` — reserved exclusively for the "default" image-export theme preview in the `ThemeCard` selector; do not use it for new UI elements
- `--nf-grad-hero` — defined but no longer applied to any UI element; do not reintroduce it for text or nav items

Nav active state uses a solid tint (`--nf-nav-active-bg`) — no gradients on nav items. Gradient text (`background-clip: text`) is not used in the app; brand color (`--nf-royal`) is used for highlighted text instead.

## Testing & Coverage

Run coverage from `client/`:
```bash
bun run test -- --coverage
```

The **client** targets 100% across all four v8 metrics (statements, lines, branches, functions) via Vitest's v8 provider.

### Coverage Exclusions

Excluded via `coverage.exclude` in `vite.config.ts`:
- `src/tests/**`, `src/main.tsx`, `src/Theme.tsx` — test infra and app entry point
- `src/vite-env.d.ts` — ambient declarations
- `src/styles/tokens.ts` — pure style constant exports
- `src/pushPayload.ts` — a type-only `interface` with no runtime code to execute
- `src/index.css` — a stylesheet; Vite's CSS import handling registers it as a coverage-tracked module with zero instrumentable statements

Adding a new exclusion requires a comment in `docs/testing-notes.md` explaining why and what it would take to test.
