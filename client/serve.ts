// Bun static-file server for the built client SPA.
//
// Replaces the `serve` npm package (a Node CLI) as the client's prod runtime,
// so the client image no longer needs Node. Lives at the workspace root
// (sibling to index.html / dist) rather than under src/: client/tsconfig.json
// has `"include": ["src"]`, so this file is invisible to the `tsc` gate in
// `bun run build` and needs no @types/bun. Run directly under Bun:
//   bun serve.ts      (PORT env, default 3000)
//
// Serves the Vite build output (dist/) with:
//   - hashed assets under /assets/* and root-level files in dist/ → the file
//   - everything else (GET) → dist/index.html, for react-router-dom's
//     client-side routing (e.g. /profile/handle, /inbox, /oauth/callback)
// The opengraph-service shim fetches index.html from here and rewrites it for
// Bluesky Cardyb, so index.html is served cleanly with text/html and no
// compression the shim can't undo.

import { fileURLToPath } from "node:url";
import { dirname, normalize, join } from "node:path";
import { statSync } from "node:fs";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "dist");
const PORT = Number(process.env.PORT ?? 3000);
const INDEX_HTML = join(DIST, "index.html");

// Resolve a request path under DIST, rejecting anything that escapes DIST or
// isn't a regular file. A bare "/" maps to dist/ (a directory) — that must
// fall through to the index.html SPA fallback rather than be streamed
// (streaming a directory throws EISDIR). Returns the absolute path of an
// existing regular file, else null.
function resolveStaticFile(urlPath: string): string | null {
  // Drop the query/hash; Bun's Request already strips them, but be defensive.
  const clean = urlPath.split("?")[0]!.split("#")[0]!;
  // Decode %xx so encoded traversal (e.g. %2e%2e) is caught by normalize too.
  const decoded = decodeURIComponent(clean);
  const resolved = normalize(join(DIST, decoded));
  if (!resolved.startsWith(DIST)) return null;
  // statSync throws on a missing path; only real regular files are served.
  // Directories, symlinks-to-dirs, sockets, etc. fall through to index.html.
  try {
    return statSync(resolved).isFile() ? resolved : null;
  } catch {
    return null;
  }
}

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(req) {
    // Only GET serves content; everything else (HEAD is fine via the file
    // path too) — keep it simple, mirror `serve`'s behaviour for the routes
    // that actually reach this container (Caddy proxies GETs).
    if (req.method !== "GET") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { "cache-control": "no-store" },
      });
    }

    const url = new URL(req.url);
    const filePath = resolveStaticFile(url.pathname);

    // A real static asset: serve it. Bun.file infers the MIME from the
    // extension (.js → application/javascript, .css → text/css, .svg →
    // image/svg+xml, .webmanifest → application/manifest+json, etc.), so the
    // service worker, manifest, icons, and hashed bundles all get the right
    // content-type. Hashed assets under /assets/* are immutable; everything
    // else is served fresh (matches what `serve` did).
    if (filePath) {
      const isImmutable = url.pathname.startsWith("/assets/");
      return new Response(Bun.file(filePath), {
        headers: {
          "cache-control": isImmutable ? "public, max-age=31536000, immutable" : "no-cache",
        },
      });
    }

    // SPA fallback: react-router-dom owns client-side routing from here.
    // index.html is served with no-cache so deploys are picked up without a
    // hard refresh (the HTML references fresh hashed asset names anyway).
    return new Response(Bun.file(INDEX_HTML), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-cache",
      },
    });
  },
});

console.log(`client (bun static) listening on http://localhost:${server.port}`);

export { server };
