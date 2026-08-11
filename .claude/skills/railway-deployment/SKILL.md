---
name: railway-deployment
description: Railway deployment rules and incident history for this repo — which builder each service must use and why native detection crashed production, why production servers must bind a wildcard HOST, and why Anubis needs a persistent ed25519 key plus a Valkey challenge store. Use when changing Railway service config, railway.json / railway/*.json files, Dockerfiles, HOST or bind settings, Anubis or Valkey config, or when debugging a Railway deploy, an unreachable backend, or users being re-challenged by Anubis.
---

# Railway deployment

The three hard rules are summarised in the root `CLAUDE.md`. This file carries the reasoning and the incident history behind them. All three exist because each has already broken production once.

## Railway deploys from Dockerfiles, not native detection

Every buildable service (`server`, `client`, `caddy`, `anubis`, `opengraph-service`, `html-to-image`, `anubis/prometheus`) has a committed `railway.json` (or, for the three repo-root-context services, `railway/server.json` / `railway/client.json` / `railway/html-to-image.json`) pinning `"builder": "DOCKERFILE"` and the Dockerfile path, following the `html-to-image/railway.json` precedent. This exists because a native RAILPACK build on the `server` service **already crashed production once**: `patchedDependencies` (which applies the Bun `undici_v8` fix in `patches/@atproto-labs%2Ffetch-node@0.3.7.patch`) is a Bun-only `package.json` field, so an `npm install`-based native build silently ignores it and the server throws `webidl.util.markAsUncloneable is not a function` on boot. CI is not a safety net for this class of failure — `DockerSmoke.yml` builds `docker/Dockerfile.server` directly and was green throughout the incident; it proves the Dockerfile works, not which builder Railway actually used.

`server`, `client`, and `html-to-image` build with `context: ..` (repo root) per `docker/docker-compose.yml` — `Dockerfile.server`/`Dockerfile.client`/`Dockerfile.html-to-image` copy the root `package.json`/`bun.lock`/`patches/` before the per-workspace source. Their Railway services must therefore have **Root Directory `/`** with a `railwayConfigFile` pointing at `railway/server.json` / `railway/client.json` / `railway/html-to-image.json` respectively (a service-level dashboard setting — the files can't share the ambient `railway.json` name, so they are named per-service and collected under `railway/`). `caddy`, `anubis`, and `opengraph-service` are self-contained (`COPY Caddyfile ./`, etc.) and keep Root Directory at their own subdirectory, where Railway picks up their ambient `railway.json` with no dashboard path to set — which is why those stay put rather than moving into `railway/`.

The `dockerfilePath` inside each file is resolved relative to the service's **Root Directory**, not to the config file's own location — `anubis/prometheus/railway.json` sets `anubis/prometheus/Dockerfile` from inside `anubis/prometheus/`. Relocating a config file therefore does not require touching `dockerfilePath`; only the service's config-as-code path setting changes.

Committing the config file alone does not switch the builder — Railway only reads it once a service's "Config-as-code path" is set in the dashboard (or via the Railway MCP `update-service` tool's `railwayConfigFile`/`rootDirectory`/`dockerfilePath` params). Do not assume a checked-in `railway.json` is active; confirm with `get-service-config` (via the Railway MCP or dashboard) that `build.builder` reads `DOCKERFILE`, not `RAILPACK`/`NIXPACKS`, before relying on it.

## Production server services must bind a wildcard HOST

Every production server service (`Navyfragen Server NA`, `Navyfragen Server EU`) must have `HOST` set to a wildcard — `::` (preferred, dual-stack) or `0.0.0.0`. Caddy reaches the server only over Railway's private IPv6-only network (`BACKEND_DOMAIN = ${{Backend.RAILWAY_PRIVATE_DOMAIN}}`), so anything else is unreachable: a loopback bind (`localhost`, `127.0.0.1`) boots "healthy" and logs `Server (production) running on port http://localhost:8080`, with the only failure signal — `connection refused` — surfacing in *Caddy's* logs, not the server's. Both server services shipped with `HOST=localhost` and were silently unreachable until 2026-07-25 (#298).

This is now enforced at boot: `assertProductionBindHost()` in `src/lib/assert-production-bind-host.ts` runs first in `Server.create()` and throws on a non-wildcard `HOST` when `NODE_ENV=production`. A restart loop on Railway is strictly more debuggable than an invisible outage. The guard is a no-op outside production, so local loopback testing (`HOST=127.0.0.1`) and the test suite (`NODE_ENV=test`, `HOST=localhost`) are unaffected.

Operational notes:

- `HOST` should be a **shared/environment-level variable** on Railway, not a per-service variable, so it cannot drift between NA and EU independently — the incident had both misconfigured because each had been set separately.
- The ad-hoc `HOST=::` fix applied via the Railway API on 2026-07-25 is the *only* thing currently holding production reachable. Recreating either service, adding a new environment, or "fixing" `HOST` to a plausible-looking value like `127.0.0.1` would reintroduce the outage — now with a loud boot failure rather than a silent one.
- Confirm with `get-service-config` (Railway MCP or dashboard) that `HOST` reads `::` (or `0.0.0.0`) on every server service before relying on it; do not assume a dashboard value matches what the running container received.

## Anubis challenge state must outlive a single process

Anubis holds two pieces of state that a user's in-flight challenge depends on: the ed25519 key its cookies are signed with, and the issued-challenge records themselves. Both default to being process-local, and both defaults are wrong here.

- **`ED25519_PRIVATE_KEY_HEX` is a required env var on the Anubis service**, not an optional one. Left unset, Anubis calls `ed25519.GenerateKey(rand.Reader)` at boot and logs `generating random key, Anubis will have strange behavior when multiple instances are behind the same load balancer target`. Every restart then mints a new key and silently invalidates every outstanding cookie, so `COOKIE_EXPIRATION_TIME=168h` promises a week of validity the deployment cannot honor. Symptom: users are re-challenged at random and "clearing cookies fixes it" — see issue #306.
- **`store` in `botPolicy.json` points at Valkey, not the default `memory` backend**, whose own docs say "do not use this persistently in production". The Caddyfile reaches Anubis through `dynamic a` DNS with `refresh 1s` and `lb_policy round_robin`, which deliberately treats every DNS result as a separate upstream. Steady state is one replica, but a Railway deploy overlaps the old and new instances, and with a memory store those two have disjoint challenge tables.

Anubis cannot read the store URL from an environment variable (upstream TecharoHQ/anubis#1152), so it is a literal in the committed policy file. That is why the Valkey service runs **without a password** — a credential in this file would be a credential in a public repo. It is reachable only over Railway's project-scoped private network, and the only thing in it is challenge state with a 30-minute TTL. Do not "harden" it by adding auth without first solving the interpolation problem, or the URL in `botPolicy.json` stops matching and Anubis fails to reach its store.

The Valkey service must be up before Anubis boots, and must bind `::` — Railway's private network is IPv6-only. "Before" is literal: `valkey.Factory` dials and PINGs the store while *parsing the policy file*, so an unreachable Valkey is `can't parse policy file: valkey.Factory: ping failed` and a crash loop, not a degraded mode that recovers when the store appears. `docker/docker-compose.yml` encodes this as `condition: service_healthy`, and gives its Valkey the network alias `valkey.railway.internal` so the one committed URL literal resolves in both environments.
