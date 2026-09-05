import { parseAtUri, parseURI, type ParsedURI } from "@aturi.to/waypoints-react";

/**
 * The Aturi catalog target for a posted answer: what `useWaypoints` resolves
 * every "Open in…" destination against, and what `useUniversalLink` builds a
 * shareable aturi.to link from.
 *
 * @see [waypointTarget.test.ts](../tests/lib/waypointTarget.test.ts): pins the
 * handle substitution and the null return for a URI that names no record.
 */
export type WaypointTarget = ParsedURI;

/**
 * Derive the catalog target from the AT URI of the Bluesky post an answer
 * became, or null when the URI names no record and there is nothing to open.
 *
 * An AT URI addresses its author by DID, so every destination built from one
 * spells out `did:plc:…` where a reader expects a name. `handle` replaces it
 * when the session knows one — the DID stays on `did`, which is what the
 * handful of DID-only clients in the catalog read anyway.
 */
export function postWaypointTargetFor(
  uri: string | undefined,
  handle: string | undefined
): WaypointTarget | null {
  const match = uri ? parseAtUri(uri) : null;
  if (!match) return null;
  return handle ? { ...match.parsed, handle } : match.parsed;
}

/**
 * Derive the catalog target for an account's profile, or null without a handle
 * to address it by.
 *
 * The DID is the mirror of what `postWaypointTargetFor` does with a handle:
 * `pdsls`, `atptools`, `margin`, `grain` and `popfeed` address a repo only by
 * DID, and the catalog drops all five from a target that carries none.
 *
 * @see [waypointTarget.test.ts](../tests/lib/waypointTarget.test.ts): pins that
 * the DID-only clients appear only once a DID is supplied.
 */
export function profileWaypointTargetFor(
  handle: string | undefined,
  did: string | undefined
): WaypointTarget | null {
  if (!handle) return null;
  const parsed = parseURI(handle);
  return did ? { ...parsed, did } : parsed;
}
