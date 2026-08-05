## Navyfragen Client

The frontend portion of the app is intentionally kept as simple as possible for speed, since its entirely client-side rendered.

## Tech Stack

The React framework is **[Vite](https://vite.dev/)**, which is what seems to be the fastest framework for this sort of application. **React Router** is used for page level navigation without a full refresh. Communication with the backend is abstracted out by [**TanStack/React Query**](https://tanstack.com/query/latest/docs/framework/react/overview). While this might seem like overkill, it wraps the standard fetch requests which are made which makes it easier to set things like headers, and makes it easier to manage data coming from the server, since almost all the data processing is server side.

The component library used is [**Mantine**](mantine.dev) (yes like the Pokemon). There's some cool stuff you can do with custom styles but only the barebones are used.

## API Layer

Each domain (auth, messages, profile, settings) has a service file in `src/api/` that exports plain functions and React Query hooks. All API calls use `credentials: "include"` for cookie forwarding. The base URL is read from the `VITE_API_URL` env var and defaults to `""` (same-origin), so you don't need to set it for local development when running both client and server together.

## Runtime

Everything runs on **Bun**. You do not need Node installed to develop, build, lint, or test the client.

```bash
bun run dev        # Vite dev server
bun run build      # tsc + vite build (the same pair the Docker image runs)
bun run test       # Vitest
bun run probe:bun  # canary: asserts the runtime is Bun and the dev server transforms TSX
```

The scripts spell the runtime out with `bunx --bun` rather than relying on `bun run`, which hands node-shebang binaries (`vite`, `vitest`, `tsc`, `oxlint` all have one) back to Node whenever Node happens to be installed. Without the flag you get Node locally and Bun in Docker, silently.

## Testing

Tests use **Vitest** + `@testing-library/react` + `happy-dom`. MSW is available for API mocking. Test setup is at `src/tests/setupTests.ts`.

```bash
bun run test          # single run
bun run test:watch    # watch mode
bun run test:coverage # coverage gate, 100% on all four metrics
```

Coverage uses Vitest's **istanbul** provider. The v8 provider does not work under Bun: it drives `node:inspector`'s Profiler domain, which Bun does not implement, so every worker reports `Coverage APIs are not supported` and the totals come back 0% while the run still exits green on the test count. istanbul instruments the source at transform time instead, and needs no V8 inspector.

Suppress unreachable code with `/* istanbul ignore if */`, `/* istanbul ignore else */`, or `/* istanbul ignore next */`. The `/* v8 ignore */` form does nothing here. Note that istanbul only attaches these hints to statements, functions, and `if` nodes, so a marker in front of a bare sub-expression is silently dropped; hoist the expression into a statement first. Every use is catalogued in `docs/testing-notes.md`.

One import rule follows from the runtime: use `import * as z from "zod"`, not `import { z }`. Zod v4 re-exports its own namespace under the name `z`, and that single binding comes back `undefined` through Vitest's module runner on Bun.
