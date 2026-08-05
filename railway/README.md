# Railway config-as-code

Build config for the three services whose Docker build context is the **repo root**. Each pins
`"builder": "DOCKERFILE"` so Railway never falls back to a native RAILPACK build — a RAILPACK build
of `server` silently ignores `patchedDependencies` and crashed production once. See `CLAUDE.md` →
"Railway deploys from Dockerfiles, not native detection" for the full incident.

| Service | Config-as-code path | Root Directory | Builds |
|---|---|---|---|
| `server` | `railway/server.json` | `/` | `docker/Dockerfile.server` |
| `client` | `railway/client.json` | `/` | `docker/Dockerfile.client` |
| `html-to-image` | `railway/html-to-image.json` | `/` | `docker/Dockerfile.html-to-image` |

These three cannot share the ambient `railway.json` filename, so each is named per-service and
collected here rather than scattered across the repo root.

## Services that are deliberately not here

`caddy`, `anubis`, `opengraph-service`, and `anubis/prometheus` keep a plain `railway.json` in their
own directory. Their Root Directory is that directory, so Railway discovers the file ambiently with
no config-as-code path to set. Moving them here would mean setting that path on each service for no
gain, so they stay put.

## Changing the path is a dashboard action

Committing or moving a file here does **not** by itself change what Railway builds. The service's
"Config-as-code path" must be updated in the dashboard (or via the Railway MCP `update-service`
tool's `railwayConfigFile` param). Until then the service keeps using its previous path — which,
after a move like this one, no longer exists, and Railway falls back to native detection.

Confirm with `get-service-config` that `build.builder` reads `DOCKERFILE` rather than
`RAILPACK`/`NIXPACKS` before relying on it.

`dockerfilePath` inside each file resolves relative to the service's **Root Directory**, not to the
config file's own location, so relocating these files did not require editing them.
