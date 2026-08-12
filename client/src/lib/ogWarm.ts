/**
 * Asks the OG service to render this profile's card before a crawler does.
 *
 * Deliberately not `apiClient`: that points at `VITE_API_URL`, the backend,
 * while the OG service is a transparent reverse proxy in front of this client,
 * so in production its own origin *is* the OG service. In development nothing
 * sits in front of the client and this 404s, which is why the whole thing is
 * fire-and-forget — a warm that fails costs the user a cold first crawl, never
 * an error.
 *
 * @see [ogWarm.test.ts](../tests/lib/ogWarm.test.ts): pins the request shape and
 * that a rejected warm never reaches the caller.
 */
export function warmOgCard(handle: string): void {
  if (!handle) return;
  void fetch(`/og-warm/${encodeURIComponent(handle)}`, { method: "POST" }).catch(() => undefined);
}
