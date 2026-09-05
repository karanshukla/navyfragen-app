import {
  buildWaypointsForParsed,
  parseURI,
  WAYPOINT_DESTINATIONS_DATA,
  WAYPOINT_ORDER,
  waypointActivity,
  type WaypointData,
} from "@aturi.to/waypoints";
import { Logger } from "pino";

import { EXTRA_APPS } from "../lib/atmosphere-extras";
import { isPublicPdsUrl } from "../lib/public-pds-url";
import { withRetry } from "../lib/retry";
import { createTtlCache } from "../lib/ttl-cache";

/** The DID-document lookup this service needs, narrowed for injection. */
export interface AtprotoDataResolver {
  did: { resolveAtprotoData(did: string): Promise<{ pds?: string } | undefined> };
}

/** What a repo scan costs, so a public page never pays for it twice in an hour. */
const PRESENCE_TTL_MS = 60 * 60 * 1000;

/**
 * A failed scan is cached too, or an unreachable PDS is re-dialled on every
 * view of that profile. Kept far shorter than a success: a transient outage
 * must not hide someone's apps for an hour.
 */
const FAILURE_TTL_MS = 5 * 60 * 1000;

const MAX_CACHED_REPOS = 500;

/** Per attempt, not per loop, so one hung PDS cannot eat the retry budget. */
const DESCRIBE_REPO_TIMEOUT_MS = 5000;

const NO_APPS: string[] = [];

interface DescribeRepoResponse {
  collections?: string[];
}

/**
 * Records every Bluesky account already has, and so evidence of nothing. Twelve
 * catalog entries declare this prefix and nothing else — Deer, Northsky,
 * Blacksky, Bluepy and the rest are alternative readers of the same records,
 * not places their owner separately signed up for.
 */
const BLUESKY_PREFIX = "app.bsky.";

/** The prefixes that would say this account writes something beyond Bluesky. */
function beyondBluesky(entry: WaypointData): string[] {
  return (entry.expectedCollections ?? []).filter((prefix) => !prefix.startsWith(BLUESKY_PREFIX));
}

/**
 * One key per body of data, so five readers of one blog are one icon.
 *
 * `redirectCompat` is the catalog's own answer to "which of these render the
 * same records": Leaflet, Offprint, Pckt, Standard Reader and Anisota Reader
 * all sit in `standard-site` and all render the one `pub.leaflet.` repo.
 */
function dataFamilyOf(entry: WaypointData): string {
  return entry.redirectCompat.join("|");
}

/**
 * The Atmosphere apps whose own records `collections` contains, one per body of
 * data, in the catalog's recommendation order.
 *
 * Presence is judged only on the prefixes outside `app.bsky.`, so this answers
 * "what else does this account publish" rather than "what could open it" —
 * every Bluesky account would answer the latter identically and the row would
 * say nothing about anyone.
 *
 * `waypointActivity` reports `unknown` rather than `present` for an entry left
 * with no prefixes, which takes care of the generic record browsers (PDSls,
 * atp.tools, Aturi) and the Bluesky-only clients in one step.
 *
 * @see [atmosphere-service.test.ts](../tests/atmosphere-service.test.ts):
 * "omits a Bluesky-only client every account would match" and "counts five
 * readers of one blog once".
 */
export function appsPresentIn(collections: ReadonlySet<string>): string[] {
  const seenFamilies = new Set<string>();
  const present: string[] = [];

  for (const id of WAYPOINT_ORDER) {
    const entry = WAYPOINT_DESTINATIONS_DATA[id];
    if (!entry) continue;
    const expectedCollections = beyondBluesky(entry);
    if (waypointActivity({ expectedCollections }, collections) !== "present") continue;

    const family = dataFamilyOf(entry);
    if (seenFamilies.has(family)) continue;
    seenFamilies.add(family);
    present.push(id);
  }

  for (const app of EXTRA_APPS) {
    if (
      waypointActivity({ expectedCollections: app.collectionPrefixes }, collections) === "present"
    ) {
      present.push(app.id);
    }
  }

  return present;
}

/** An app to show in the profile row, resolved to somewhere a reader can go. */
export interface AtmosphereAppLink {
  id: string;
  name: string;
  url: string;
}

/**
 * Turn the ids `appsPresentIn` found into names and destinations.
 *
 * Kept apart from the repo scan because the scan is cached per DID for an hour
 * and a handle can change inside that window, which would leave the cache
 * holding links to a name its owner no longer has.
 *
 * @see [atmosphere-service.test.ts](../tests/atmosphere-service.test.ts):
 * "drops an app that cannot address this account".
 */
export function appLinksFor(
  ids: readonly string[],
  handle: string | undefined,
  did: string | undefined
): AtmosphereAppLink[] {
  if (!handle) return [];

  const parsed = parseURI(handle);
  const target = did ? { ...parsed, did } : parsed;
  const catalogUrls = new Map(
    buildWaypointsForParsed(target).waypoints.map((waypoint) => [waypoint.id, waypoint.url])
  );
  const extrasById = new Map(EXTRA_APPS.map((app) => [app.id, app]));

  return ids.flatMap((id) => {
    const extra = extrasById.get(id);
    if (extra) return [{ id, name: extra.name, url: extra.profileUrl(handle) }];

    const url = catalogUrls.get(id);
    return url ? [{ id, name: WAYPOINT_DESTINATIONS_DATA[id].name, url }] : [];
  });
}

export class AtmosphereService {
  private cache = createTtlCache<string[]>(MAX_CACHED_REPOS);

  constructor(
    private idResolver: AtprotoDataResolver,
    private logger: Logger,
    private fetchImpl: typeof fetch = fetch
  ) {}

  /**
   * Which Atmosphere apps an account uses, read off its own PDS.
   *
   * Never throws and never rejects: this decorates a public profile, so a PDS
   * that is slow, unreachable, or lying answers "no apps" rather than taking
   * the whole page down with it.
   *
   * @see [atmosphere-service.test.ts](../tests/atmosphere-service.test.ts):
   * "answers with no apps rather than throwing when the PDS is unreachable".
   */
  async presenceFor(did: string): Promise<string[]> {
    const cached = this.cache.get(did);
    if (cached) return cached;

    try {
      const present = appsPresentIn(await this.scanRepo(did));
      this.cache.set(did, present, PRESENCE_TTL_MS);
      return present;
    } catch (err) {
      this.logger.warn({ err, did }, "Failed to scan repo for Atmosphere apps");
      this.cache.set(did, NO_APPS, FAILURE_TTL_MS);
      return NO_APPS;
    }
  }

  private async scanRepo(did: string): Promise<Set<string>> {
    const atprotoData = await this.idResolver.did.resolveAtprotoData(did);
    const pds = atprotoData?.pds;
    if (!pds || !isPublicPdsUrl(pds)) {
      throw new Error(`Refusing to scan a repo at a non-public PDS: ${pds}`);
    }

    const url = `${pds.replace(/\/$/, "")}/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(did)}`;
    const body = await withRetry(() => this.readDescribeRepo(url), this.logger, {
      did,
      op: "describeRepo",
    });
    return new Set(body.collections ?? []);
  }

  /**
   * `redirect: "manual"` is the other half of `isPublicPdsUrl`. Validating the
   * URL alone is not enough: a PDS on a perfectly public hostname can answer
   * 302 and send the follow-up request to a private address, which puts the
   * fetch back inside the network the check exists to keep it out of. A real
   * describeRepo does not redirect, so a 3xx is refused rather than followed.
   *
   * @see [atmosphere-service.test.ts](../tests/atmosphere-service.test.ts):
   * "refuses to follow a redirect away from the PDS it validated".
   */
  private async readDescribeRepo(url: string): Promise<DescribeRepoResponse> {
    const response = await this.fetchImpl(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(DESCRIBE_REPO_TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) {
      throw new Error(`describeRepo redirected to ${response.headers.get("location")}`);
    }
    if (!response.ok) {
      throw new Error(`describeRepo answered ${response.status}`);
    }
    return (await response.json()) as DescribeRepoResponse;
  }
}
