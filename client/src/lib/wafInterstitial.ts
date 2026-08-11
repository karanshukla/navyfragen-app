/**
 * Anubis, the WAF in front of this app, serves its challenge interstitial as
 * HTML under HTTP 200 (`status_codes.CHALLENGE` in `anubis/botPolicy.json`), so
 * `response.ok` cannot distinguish a real asset from a challenge and workbox
 * caches anything ok. A challenge stored under a bundle URL then serves HTML as
 * JavaScript, and Caddy stamps `immutable` on `/assets/*`, so the entry survives
 * until the user clears site data by hand.
 *
 * Content type read against the URL's own extension is the only signal that
 * survives the proxy: the challenge carries no distinguishing header, and Caddy
 * rewrites Cache-Control on the way out.
 *
 * `anubis/botPolicy.json` allowing these paths is the primary fix; this is the
 * guard for the next time a generated filename stops matching that policy.
 *
 * @see [wafInterstitial.test.ts](../tests/lib/wafInterstitial.test.ts): pins an
 * HTML body under an asset URL as rejected and the same body under a document
 * URL as allowed.
 */
const NON_HTML_ASSET = /\.(css|ico|js|json|mjs|png|svg|webmanifest|webp|woff|woff2)$/i;

export function isWafInterstitial(url: string, contentType: string | null): boolean {
  if (!contentType?.toLowerCase().includes("text/html")) return false;
  return NON_HTML_ASSET.test(new URL(url).pathname);
}
