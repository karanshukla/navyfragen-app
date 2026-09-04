import {
  buildWaypointsForParsed,
  getWaypointDataForType,
  WAYPOINT_DESTINATIONS_DATA,
} from "@aturi.to/waypoints-react";

import { postWaypointTargetFor, type WaypointTarget } from "./waypointTarget";

export interface ClientOption {
  value: string;
  label: string;
}

/** The record an answer posted from here becomes. */
const POST_COLLECTION = "app.bsky.feed.post";

/** A profile target names no record of its own; this is the one it stands for. */
const PROFILE_COLLECTION = "app.bsky.actor.profile";

const collectionsByClient = new Map(
  Object.values(WAYPOINT_DESTINATIONS_DATA).map((client) => [client.id, client.expectedCollections])
);

/**
 * Whether a client renders the records in `collection`, as opposed to merely
 * being able to build a URL for one. The catalog's "post" list is every client
 * that can address a post-shaped AT URI, which includes a git forge and four
 * publication readers that would show a reader nothing.
 *
 * A client declaring no collections is a generic record browser, and those do
 * render anything.
 *
 * @see [waypointClients.test.ts](../tests/lib/waypointClients.test.ts): pins
 * that a Bluesky post is never offered to a client for another lexicon.
 */
function clientRenders(clientId: string, collection: string): boolean {
  const expected = collectionsByClient.get(clientId);
  return !expected || expected.some((prefix) => collection.startsWith(prefix));
}

function collectionOf(target: WaypointTarget): string {
  return target.collection ?? PROFILE_COLLECTION;
}

/** Whether this client is somewhere worth sending a reader for `target`. */
export function clientRendersTarget(clientId: string, target: WaypointTarget): boolean {
  return clientRenders(clientId, collectionOf(target));
}

/**
 * The Atmosphere clients that render the posts and profiles this app links to,
 * as Mantine Select options. Alphabetical: the catalog's own order is a
 * recommendation ranking, which is the wrong shape for a list someone is
 * scanning for a name.
 */
export const postClientOptions: ClientOption[] = getWaypointDataForType("post")
  .filter((client) => clientRenders(client.id, POST_COLLECTION))
  .map((client) => ({ value: client.id, label: client.name }))
  .sort((a, b) => a.label.localeCompare(b.label));

const clientNames = new Map(postClientOptions.map((option) => [option.value, option.label]));

/** The catalog's display name for a stored client id, or null if it has none. */
export function clientNameFor(clientId: string | null): string | null {
  return clientId === null ? null : (clientNames.get(clientId) ?? null);
}

/**
 * Where `clientId` renders the record `target` names, or null when no client is
 * chosen and when the chosen one is not somewhere to send a reader — a stored id
 * outlives both the catalog entry that explains it and the list it was offered
 * from, so either has to read as "no preference" rather than as a dead link.
 */
export function clientUrlFor(target: WaypointTarget, clientId: string | null): string | null {
  if (clientId === null || !clientRendersTarget(clientId, target)) return null;
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
 * chosen client when it renders this record, else Bluesky. Null only when there
 * is no target, or when even Bluesky cannot open it.
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

/**
 * Where a posted answer opens: the chosen client, else the Bluesky link the
 * server posted alongside the record. The card for an answer and the toast
 * confirming a new one both read it, and the two have to agree.
 *
 * @see [waypointClients.test.ts](../tests/lib/waypointClients.test.ts): pins
 * that an unusable client keeps the link the server posted.
 */
export function postedAnswerLink(
  uri: string | undefined,
  postedLink: string | undefined,
  handle: string | undefined,
  clientId: string | null
): string | undefined {
  const target = postWaypointTargetFor(uri, handle);
  return (target ? clientUrlFor(target, clientId) : null) ?? postedLink;
}
