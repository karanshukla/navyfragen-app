# Docker Compose Stack

This stack is used for **local integration testing and smoke tests** (and optionally self-hosting). It mirrors production closely: Railway builds every service from these same Dockerfiles (pinned via `railway.server.json` / `railway.client.json` at the repo root and `railway.json` in each self-contained service directory — see `CLAUDE.md` → "Deployment (Railway)").

## Services

| Service | Description | Port |
|---------|-------------|------|
| `caddy` | Reverse proxy: `/*` → client, `/api/*` → server. **Default local entry point.** | 8082 |
| `anubis` | Bot-protection WAF, production topology (Anubis → Caddy) | 8080 |
| `server` | Bun.serve + Hono API | 3000 |
| `client` | React SPA served by `serve` | internal |
| `html-to-image` | Puppeteer image renderer | internal |
| `redirector` | Short-URL redirector (fragen.navy equivalent) | 8081 |
| `postgres` | PostgreSQL 16 | internal |

`caddy` and `server` are published directly so the stack works out of the box for local dev with no extra setup — see "Caveats" for why `anubis` isn't the default entry point locally even though it is in production.

## Quick start

```bash
cp docker/.env.example docker/.env
# Fill in OAUTH_TOKEN_SECRET and COOKIE_SECRET (openssl rand -hex 32)

docker compose -f docker/docker-compose.yml up --build
```

The app is available at `http://localhost:8082` (via Caddy directly). The short-URL redirector is at `http://localhost:8081`. The production-topology entry point through Anubis is at `http://localhost:8080` — see the Anubis caveat below before using it directly in a browser.

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
| `Dockerfile.server` | Bun.serve + Hono API image (build context: repo root) |
| `.env.example` | Secret template — copy to `.env` before running |

`client/Dockerfile` and `server/Dockerfile` are intentionally absent — all Docker-related files live under `docker/` to keep the service directories clean. Railway is explicitly pinned to `docker/Dockerfile.client` / `docker/Dockerfile.server` via config-as-code (`railway.client.json` / `railway.server.json` at the repo root — see `CLAUDE.md` → "Deployment (Railway)"), so it doesn't rely on auto-detection either way.

## Caveats

- **OAuth login works out of the box — leave `PUBLIC_URL` unset.** With `PUBLIC_URL` unset, the server uses the RFC 8252 loopback OAuth client format, and Bluesky redirects your browser straight back to `http://127.0.0.1:3000/oauth/callback` — no tunnel needed, as long as you're testing through a URL where port 3000 is reachable (true by default; see the `server` service's `ports` in `docker-compose.yml`). A tunnel (e.g. ngrok) and a real `https://` `PUBLIC_URL` are only needed if you specifically want a non-loopback public URL, e.g. to test OG image previews against an external crawler. `PUBLIC_URL` set to any plain `http://` value (including `http://localhost:8080`) will crash the server at boot — see the comment in `.env.example`.
- **Anubis PoW challenge, and why it's not the local default.** Anubis serves a proof-of-work challenge to unknown clients and additionally requires an upstream proxy to set `X-Real-Ip` (production: Railway's edge; CI: `DockerSmoke.yml` sets it explicitly on the `/robots.txt` check). A plain browser hitting `http://localhost:8080` directly gets a `[misconfiguration] X-Real-Ip header is not set` error rather than even reaching the challenge page. Use `http://localhost:8082` (Caddy directly) for everyday local dev; use port 8080 only when you're deliberately testing Anubis itself.
- **html-to-image requires `shm_size: 256m`.** Chromium inside Docker needs more `/dev/shm` than the default 64 MB. This is set in the compose file but may require Docker Desktop to have sufficient memory allocated.
- **Not tested on ARM (Apple Silicon).** The `anubis` and `html-to-image` images may need `platform: linux/amd64` on M-series Macs.
