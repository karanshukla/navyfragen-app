# opengraph-service — Railway configuration

This service runs between Caddy and the client: it reverse-proxies all `/*`
traffic unchanged except `Bluesky Cardyb` requests on `/profile/:handle`, where
it generates and serves a per-profile OG image (see the [workflow summary](../.claude/investigations/227-complete.md) for the full design).

The variables below are read from the environment by `cmd/shim/main.go`. Every
one has a sensible default, so in a normal Railway private-network deployment
you only **need** to set `FRONTEND_URL` and `EXPORT_HTML_URL` — the rest are
tuned for the production topology already.

## Service

- **Source:** root of the repo; Dockerfile at `opengraph-service/Dockerfile`
  (multi-stage `golang` build → distroless static runtime).
- **Port:** listens on `$PORT` (Railway injects this automatically — leave it).
- **Health:** `GET /healthz` returns `200` once the proxy is wired up.

## Required variables

| Variable | Example | Purpose |
|---|---|---|
| `FRONTEND_URL` | `http://client.railway.internal:3000` | The upstream client SPA to proxy to. This is where Caddy's `FRONTEND_DOMAIN`/`FRONTEND_PORT` *used* to point. On Railway, use the client service's private URL. |
| `EXPORT_HTML_URL` | `http://html-to-image.railway.internal:3033/` | The `html-to-image` service, called by the generate path to render the composited PNG. |

## Optional variables (defaults are production-correct)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | Listen port. Railway injects this automatically; leave unset unless you need to override. |
| `ATPROTO_APPVIEW_HOST` | `https://api.bsky.app` | AT Protocol AppView host for handle→DID resolution and `getProfile`. Matches `server/src/services/profile-service.ts` exactly — only change if you run a private AppView. |
| `PUBLIC_URL` | `https://navyfragen.app` | Public site origin. Used to build absolute `og:image` URLs (the cached PNG is served at `$PUBLIC_URL/og-cache/<did>.png`). Set this to your production domain. |
| `OG_CACHE_DIR` | `/data/og-cache` | Cache directory on disk. **Must be inside the mounted Railway volume** (see Volumes below). |
| `OG_CACHE_TTL` | `720h` (~30 days) | How long a cached image is served before a fresh indigo+render round-trip. Go duration string (`720h`, `168h`, etc.). Accepted staleness tradeoff — see issue #227. |
| `OG_CACHE_MAX_ENTRIES` | `10000` | Max entries before LRU eviction. `0` = built-in default. One entry = one user (keyed by DID). |
| `OG_RENDER_TIMEOUT` | `30s` | Deadline for a single `html-to-image` render. Go duration string. |

## Volume

Attach a Railway volume and mount it at `/data` (the service writes cache files
under `$OG_CACHE_DIR`, i.e. `/data/og-cache`). The image pre-creates
`/data/og-cache` as writable by the distroless non-root user, so **a fresh
empty volume works out of the box**. A pre-existing root-owned volume would
need `chown`-ing to uid `65532` (the nonroot uid) — simplest path is to create
a new volume for this service.

See [Railway volumes docs](https://docs.railway.app/reference/volumes).

## Wiring it into the stack (one-time)

1. **Create the service** from this directory with the variables above + the
   volume mounted at `/data`.
2. **Repoint Caddy** (the *existing* Caddy service, not this one): change its
   `FRONTEND_DOMAIN` / `FRONTEND_PORT` from the client service to
   `opengraph-service` / `8080`. This is an env-var-only change — no Caddyfile
   edit (the `caddy/entrypoint.sh` interpolates `{$FRONTEND_DOMAIN}` /
   `{$FRONTEND_PORT}`).
3. **Confirm `/api/*` is unaffected**: Caddy's `handle_path /api/*` routes to
   the server *before* the `/*` reverse-proxy, so API traffic never enters
   this shim — no action needed, but worth a smoke test after the repoint.
4. **Confirm egress** from `html-to-image` to `cdn.bsky.app` (where Bluesky
   banner/avatar blobs live) is reachable in your Railway environment, or the
   render will fetch broken images.
