import { WAYPOINT_ICONS } from "@aturi.to/waypoints-react";
import type { ReactNode } from "react";

/** One app as the server resolved it: already named and already addressed. */
export interface AtmosphereAppLink {
  id: string;
  name: string;
  url: string;
}

export interface AtmosphereApp extends AtmosphereAppLink {
  /** The catalog's brand mark, or null for an app it does not carry. */
  icon: ReactNode | null;
}

/**
 * Attach each app's brand mark.
 *
 * Only the naming and the destination come from the server, because it holds
 * the supplementary table for apps the Aturi catalog omits. The marks are
 * React nodes and stay here — an app the catalog omits has none, and gets a
 * generic one from the component instead.
 *
 * @see [atmosphereApps.test.ts](../tests/lib/atmosphereApps.test.ts): pins that
 * an uncatalogued app comes back with no mark rather than being dropped.
 */
export function withMarks(links: readonly AtmosphereAppLink[]): AtmosphereApp[] {
  return links.map((link) => ({ ...link, icon: WAYPOINT_ICONS[link.id] ?? null }));
}
