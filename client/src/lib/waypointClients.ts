import { buildWaypointsForParsed, getWaypointDataForType } from "@aturi.to/waypoints-react";

import type { WaypointTarget } from "./waypointTarget";

export interface ClientOption {
  value: string;
  label: string;
}

/**
 * Every Atmosphere client in Aturi's catalog that can render a post, as Mantine
 * Select options. Alphabetical: the catalog's own order is a recommendation
 * ranking, which is the wrong shape for a list someone is scanning for a name.
 */
export const postClientOptions: ClientOption[] = getWaypointDataForType("post")
  .map((client) => ({ value: client.id, label: client.name }))
  .sort((a, b) => a.label.localeCompare(b.label));

const clientNames = new Map(postClientOptions.map((option) => [option.value, option.label]));

/** The catalog's display name for a stored client id, or null if it has none. */
export function clientNameFor(clientId: string | null): string | null {
  return clientId === null ? null : (clientNames.get(clientId) ?? null);
}

/**
 * Where `clientId` renders the post `target` names, or null when no client is
 * chosen and when the chosen one cannot open this record — a stored id outlives
 * the catalog entry that explains it, so an unknown id has to read as "no
 * preference" rather than as a dead link.
 */
export function clientUrlFor(target: WaypointTarget, clientId: string | null): string | null {
  if (clientId === null) return null;
  const match = buildWaypointsForParsed(target).waypoints.find(
    (waypoint) => waypoint.id === clientId
  );
  return match?.url ?? null;
}
