import { clientDestinationFor } from "./waypointClients";
import { profileWaypointTargetFor } from "./waypointTarget";

export interface MentionLink {
  href: string;
  /** True for an in-app route, which navigates without a page load. */
  internal: boolean;
}

export type MentionLinkResolver = (handle: string) => MentionLink;

/** This app's own page for an account, which needs no Atmosphere client at all. */
function inAppProfilePath(handle: string): string {
  return `/profile/${handle}`;
}

/**
 * Where an @mention in someone's bio goes, given how the reader answered the
 * two questions on /customise: whether to stay in this app, and which client to
 * leave to when they don't.
 *
 * A bio carries handles, never DIDs, so the clients that address a repo only by
 * DID cannot render one of these and the reader lands on Bluesky instead.
 *
 * @see [mentionLink.test.ts](../tests/lib/mentionLink.test.ts): pins both
 * answers and the fallback for a handle no client can build a link from.
 */
export function mentionLinkFor(clientId: string | null, openInApp: boolean): MentionLinkResolver {
  return (handle) => {
    const destination = openInApp
      ? null
      : clientDestinationFor(profileWaypointTargetFor(handle, undefined), clientId);
    return destination
      ? { href: destination.url, internal: false }
      : { href: inAppProfilePath(handle), internal: true };
  };
}
