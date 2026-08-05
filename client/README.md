## Navyfragen Client

The frontend portion of the app is intentionally kept as simple as possible for speed, since its entirely client-side rendered.

## Tech Stack

The React framework is **[Vite](https://vite.dev/)**, which is what seems to be the fastest framework for this sort of application. **React Router** is used for page level navigation without a full refresh. Communication with the backend is abstracted out by [**TanStack/React Query**](https://tanstack.com/query/latest/docs/framework/react/overview). While this might seem like overkill, it wraps the standard fetch requests which are made which makes it easier to set things like headers, and makes it easier to manage data coming from the server, since almost all the data processing is server side.

The component library used is [**Mantine**](mantine.dev) (yes like the Pokemon). There's some cool stuff you can do with custom styles but only the barebones are used.

## API Layer

Each domain (auth, messages, profile, settings) has a service file in `src/api/` that exports plain functions and React Query hooks. All API calls use `credentials: "include"` for cookie forwarding. The base URL is read from the `VITE_API_URL` env var and defaults to `""` (same-origin), so you don't need to set it for local development when running both client and server together.

## Runtime

Vite and Vitest run on **Bun**, matching the rest of the repo. The scripts spell that out with `bunx --bun` rather than relying on `bun run`, which hands node-shebang binaries (`vite`, `vitest`, `tsc`) back to Node whenever Node is installed:

```bash
bun run dev        # Vite dev server, on Bun
bun run build      # tsc + vite build, on Bun (same pair the Docker image runs)
bun run probe:bun  # canary: asserts the runtime is Bun and the dev server transforms TSX
```

The one exception is `test:coverage` — see below.

## Testing

Tests use **Vitest** + `@testing-library/react` + `happy-dom`. MSW is available for API mocking. Test setup is at `src/tests/setupTests.ts`.

```bash
bun run test              # single run, on Bun
bun run test:watch        # watch mode, on Bun
bun run test:coverage     # coverage gate — v8 provider, needs Node
bun run test:coverage:bun # coverage on Bun — istanbul provider, into coverage-bun/
```

`test:coverage` is the gate and stays on Node: `@vitest/coverage-v8` drives `node:inspector`'s Profiler domain, which Bun does not implement, so under Bun every worker reports `Coverage APIs are not supported` and the totals come back 0%. `test:coverage:bun` swaps in the istanbul provider, which instruments the source instead; it works on either runtime but reports slightly lower numbers, since it counts defensive branches v8 folds away and ignores the `/* v8 ignore */` markers documented in `docs/testing-notes.md`.

One import rule follows from the runtime: use `import * as z from "zod"`, not `import { z }`. Zod v4 re-exports its own namespace under the name `z`, and that single binding comes back `undefined` through Vitest's module runner on Bun.
