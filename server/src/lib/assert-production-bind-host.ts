// A loopback bind in production is unreachable but boots "healthy", so the
// failure surfaces only in Caddy's logs — a restart loop is strictly more
// debuggable. The thrown message below carries the full rationale.

import { env } from "./env";

export const WILDCARD_HOSTS = new Set(["::", "0.0.0.0"]);

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
