/**
 * A PDS endpoint read out of a DID document is attacker-controlled: anyone can
 * publish a `did:web` whose service endpoint names a host on Railway's private
 * network, and an unauthenticated public route that fetches it turns this
 * server into a request proxy into that network.
 *
 * A real PDS is always addressed by a public domain name over TLS, so an IP
 * literal or an internal-only suffix is never one and is rejected before any
 * request goes out.
 *
 * @see [public-pds-url.test.ts](../tests/public-pds-url.test.ts): pins one
 * accepted host and one rejected host for each rule below.
 */

/** Suffixes that only ever name something inside a private network. */
const INTERNAL_SUFFIXES = [".internal", ".local", ".localhost", ".home.arpa"];

const IPV4_LITERAL = /^\d{1,3}(\.\d{1,3}){3}$/;

function isIpLiteral(hostname: string): boolean {
  // `URL` wraps an IPv6 host in brackets, which no domain name contains.
  return hostname.startsWith("[") || IPV4_LITERAL.test(hostname);
}

function isInternalName(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return !host.includes(".") || INTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/** Whether `raw` is safe to send an unauthenticated server-side request to. */
export function isPublicPdsUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  return !isIpLiteral(url.hostname) && !isInternalName(url.hostname);
}
