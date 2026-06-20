## Navyfragen Client

The frontend portion of the app is intentionally kept as simple as possible for speed, since its entirely client-side rendered.

## Tech Stack

The React framework is **[Vite](https://vite.dev/)**, which is what seems to be the fastest framework for this sort of application. **React Router** is used for page level navigation without a full refresh. Communication with the backend is abstracted out by [**TanStack/React Query**](https://tanstack.com/query/latest/docs/framework/react/overview). While this might seem like overkill, it wraps the standard fetch requests which are made which makes it easier to set things like headers, and makes it easier to manage data coming from the server, since almost all the data processing is server side.

The component library used is [**Mantine**](mantine.dev) (yes like the Pokemon). There's some cool stuff you can do with custom styles but only the barebones are used.

## API Layer

Each domain (auth, messages, profile, settings) has a service file in `src/api/` that exports plain functions and React Query hooks. All API calls use `credentials: "include"` for cookie forwarding. The base URL is read from the `VITE_API_URL` env var and defaults to `""` (same-origin), so you don't need to set it for local development when running both client and server together.

## Testing

Tests use **Vitest** + `@testing-library/react` + `happy-dom`. MSW is available for API mocking. Test setup is at `src/tests/setupTests.ts`.

```bash
npm run test        # single run
npm run test:watch  # watch mode
```
