# Docker Compose Stack

This stack is used for **local integration testing and smoke tests** (and optionally self-hosting). It is not how the production deployment works.

**Production** runs on Railway using native Railpack/Nixpacks builds — the `client/railway.json` and `server/railway.json` files govern that path.

## Services

| Service | Description | Port |
|---------|-------------|------|
| `anubis` | Bot-protection WAF — main entry point | 8080 |
| `caddy` | Reverse proxy: `/*` → client, `/api/*` → server | internal |
| `client` | React SPA served by `serve` | internal |
| `server` | Express API | internal |
| `html-to-image` | Puppeteer image renderer | internal |
| `redirector` | Short-URL redirector (fragen.navy equivalent) | 8081 |
| `postgres` | PostgreSQL 16 | internal |

## Quick start

```bash
cp docker/.env.example docker/.env
# Fill in OAUTH_TOKEN_SECRET and COOKIE_SECRET (openssl rand -hex 32)

docker compose -f docker/docker-compose.yml up --build
```

The app is available at `http://localhost:8080`. The short-URL redirector is at `http://localhost:8081`.

## Environment

All secrets go in `docker/.env` — see [`.env.example`](.env.example) for the full list. The two required secrets have no defaults:

- `OAUTH_TOKEN_SECRET` — AES-256 key for encrypting OAuth tokens
- `COOKIE_SECRET` — secret for signing session cookies

## File layout

All Docker-related files live here to keep Railway from auto-detecting them in the service directories:

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Full local stack |
| `Dockerfile.client` | React SPA image (build context: repo root) |
| `Dockerfile.server` | Express API image (build context: repo root) |
| `.env.example` | Secret template — copy to `.env` before running |

`client/Dockerfile` and `server/Dockerfile` are intentionally absent. If they existed there, Railway would detect them and attempt a Docker build instead of the Railpack npm build used in production.

## Caveats

- **Bluesky OAuth requires a public URL.** `localhost` works for local dev but the OAuth callback must be reachable by Bluesky's servers. For a fully functional local stack you need a tunnel (e.g. ngrok) and `PUBLIC_URL` set accordingly.
- **Anubis PoW challenge.** Anubis serves a proof-of-work challenge page to unknown clients. In CI the smoke test hits `/robots.txt` with `X-Real-Ip` set, which bypasses the challenge. Direct browser access on a fresh IP will trigger it.
- **html-to-image requires `shm_size: 256m`.** Chromium inside Docker needs more `/dev/shm` than the default 64 MB. This is set in the compose file but may require Docker Desktop to have sufficient memory allocated.
- **Not tested on ARM (Apple Silicon).** The `anubis` and `html-to-image` images may need `platform: linux/amd64` on M-series Macs.
