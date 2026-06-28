# E2E Testing

Playwright tests run against the full Docker stack using a real Bluesky account. Login uses an AT Protocol **app password** — your main account password is never involved.

## How it works

1. `docker-compose.e2e.yml` builds the client with `VITE_E2E_TESTING=true`, swapping the OAuth login form for a simple handle + app-password form.
2. The server enables `POST /auth/e2e-login` (only when `E2E_TESTING=true`), which creates a session via `com.atproto.server.createSession` on the configured PDS.
3. Playwright logs in once via `e2e/auth.setup.ts`, saves session cookies to `e2e/.auth/user.json`, and all specs reuse that state.
4. Playwright connects to **Caddy on port 8090** (exposed by the e2e overlay), bypassing the Anubis bot-protection WAF.
5. `playwright.config.ts` loads `docker/.env` automatically via dotenv — no manual env sourcing needed.

## Local setup

### 1. Create an app password

In your PDS account settings, create an app password named something like `navyfragen-e2e`. Copy it — you won't see it again.

### 2. Add credentials to `docker/.env`

`docker/.env` is gitignored. Add these lines alongside your existing `OAUTH_TOKEN_SECRET` / `COOKIE_SECRET`:

```
E2E_PDS_URL=https://bsky.social
E2E_HANDLE=yourhandle.bsky.social
E2E_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

### 3. Install Playwright

First time only:

```bash
npm install
npx playwright install --with-deps chromium
```

### 4. Start the e2e stack

```bash
docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.e2e.yml \
  up --build -d
```

Wait ~30 s for services to stabilise.

### 5. Run the tests

```bash
npm run test:e2e
```

Interactive UI (useful for debugging):

```bash
npm run test:e2e:ui
```

### 6. Tear down

```bash
docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.e2e.yml \
  down
```

## GitHub Actions

`.github/workflows/E2E.yml` runs on every push/PR. Add two repository secrets at **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|-------|
| `E2E_HANDLE` | `yourhandle.bsky.social` |
| `E2E_APP_PASSWORD` | App password from Bluesky settings |

`OAUTH_TOKEN_SECRET` and `COOKIE_SECRET` are generated fresh each run — no secrets needed for those. `E2E_PDS_URL` defaults to `https://bsky.social` in the compose overlay.

## Security properties

- `E2E_TESTING=true` and `VITE_E2E_TESTING=true` are **never set in production**. The bypass route and login form are absent from all non-e2e builds.
- `E2E_HANDLE` and `E2E_APP_PASSWORD` are never baked into any Docker image or source file — locally they live in gitignored `docker/.env`, in CI they come from repository secrets.
- `e2e/.auth/user.json` (saved session cookies) is gitignored and ephemeral per run.

## Adding new tests

Create `.spec.ts` files in `e2e/`. Start each with:

```typescript
import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/user.json" });
```

The `setup` project in `playwright.config.ts` runs `auth.setup.ts` first; all other specs inherit the logged-in session.
