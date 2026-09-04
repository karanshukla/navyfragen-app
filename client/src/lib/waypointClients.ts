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

/**
 * The client every link falls back to: the one the server's own post links
 * already point at, and the only name a reader sees when nothing is chosen.
 */
export const FALLBACK_CLIENT_ID = "bluesky";

export interface ClientDestination {
  url: string;
  name: string;
}

function destinationFor(target: WaypointTarget, clientId: string): ClientDestination | null {
  const url = clientUrlFor(target, clientId);
  const name = clientNameFor(clientId);
  return url && name ? { url, name } : null;
}

/**
 * Where to send someone for `target` and what to call that destination: the
 * chosen client when it can render this record, else Bluesky. Null only when
 * there is no target, or when even Bluesky cannot open it.
 *
 * Unlike an answer card, which already holds the Bluesky link the server
 * posted, a link built from nothing but a target has no second source to fall
 * back to — so the fallback is the catalog's own Bluesky entry.
 *
 * @see [waypointClients.test.ts](../tests/lib/waypointClients.test.ts): pins
 * the fallback for no preference and for an id that outlived its entry.
 */
export function clientDestinationFor(
  target: WaypointTarget | null,
  clientId: string | null
): ClientDestination | null {
  if (target === null) return null;
  const chosen = clientId === null ? null : destinationFor(target, clientId);
  return chosen ?? destinationFor(target, FALLBACK_CLIENT_ID);
}
