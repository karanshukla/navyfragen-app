// Boot-time guard: refuse to start in production on a non-wildcard HOST.
//
// `listenPreferringDualStack` in `src/index.ts` binds a non-wildcard HOST
// verbatim by design, so `HOST=127.0.0.1` still means loopback locally. That is
// correct for development and Docker Compose, but in production — where Caddy
// reaches this service only over Railway's private IPv6-only network — a
// loopback bind makes the server unreachable while still looking completely
// healthy: it boots, logs `Server (production) running on port
// http://localhost:8080`, and the only failure signal is `connection refused`
// in *Caddy's* logs, not the server's. That outage happened on both Railway
// server services on 2026-07-25; see #298.
//
// A non-wildcard HOST is never the right value in production, so this fails
// fast with an actionable message rather than degrading silently — the same
// philosophy as `assert-fetch-node-patch.ts` (#294). A restart loop on Railway
// is strictly more debuggable than an invisible-but-unreachable server.
//
// Called from `Server.create()` after `env` is read and before the DB is opened,
// so a misconfigured deploy never gets far enough to hold a connection or log a
// misleading "running" line.

import { env } from "./env";

/** The two HOST values `listenPreferringDualStack` treats as wildcards. */
export const WILDCARD_HOSTS = new Set(["::", "0.0.0.0"]);

/**
 * In production, throw if HOST is not a wildcard bind. No-op in every other
 * NODE_ENV so local loopback testing (`HOST=127.0.0.1`) and the test suite
 * (`NODE_ENV=test`, `HOST=localhost`) are unaffected.
 */
export function assertProductionBindHost(): void {
  if (env.NODE_ENV !== "production") return;
  if (WILDCARD_HOSTS.has(env.HOST)) return;

  throw new Error(
    `Refusing to boot in production with HOST=${JSON.stringify(env.HOST)}.\n` +
      "\n" +
      "A non-wildcard HOST is bound verbatim, so this would listen on loopback (or a\n" +
      "single interface) only. Caddy reaches this service over Railway's private\n" +
      "IPv6-only network, so anything other than a wildcard bind (`::` or `0.0.0.0`)\n" +
      "makes the server unreachable while still appearing healthy — see #298, which\n" +
      "tracks a 2026-07-25 outage caused by exactly this.\n" +
      "\n" +
      "Fix: set HOST=`::` (preferred — dual-stack) on the Railway service. `0.0.0.0`\n" +
      "is also accepted. This is required on every production server service\n" +
      "(Navyfragen Server NA and EU) and should be a shared/environment-level\n" +
      "variable so it cannot drift between them."
  );
}
