/* v8 ignore start */
import { AtpAgent, Agent } from "@atproto/api";
import { Logger } from "pino";

import type { Database } from "../database/db";
import type { AtmosphereAppLink, AtmosphereService } from "./atmosphere-service";
import { appLinksFor } from "./atmosphere-service";
import { fromDbBoolean } from "../lib/db-boolean";
import { withRetry } from "../lib/retry";

export interface ProfileResolver {
  resolveDidToHandle(did: string): Promise<string | undefined>;
  resolveHandleToDid(handle: string): Promise<string | undefined>;
}

const INBOX_OPEN_BY_DEFAULT = true;
const ATMOSPHERE_LINKS_ON_BY_DEFAULT = true;

/** What an account shows when it has asked not to advertise its other apps. */
const NO_ATMOSPHERE_APPS: AtmosphereAppLink[] = [];
const MAX_SOCIAL_GRAPH_PAGES = 5;

type FriendEntry = { did: string; handle: string; displayName?: string; avatar?: string };

export interface FriendGroups {
  moots: FriendEntry[];
  following: FriendEntry[];
  oomfs: FriendEntry[];
}

async function collectPagedActors(
  fetchPage: (cursor: string | undefined) => Promise<{
    success: boolean;
    data: { follows?: FriendEntry[]; followers?: FriendEntry[]; cursor?: string };
  }>
): Promise<Map<string, FriendEntry>> {
  const actors = new Map<string, FriendEntry>();
  let cursor: string | undefined;
  for (let page = 0; page < MAX_SOCIAL_GRAPH_PAGES; page++) {
    const res = await fetchPage(cursor);
    if (!res.success) break;
    const items = res.data.follows ?? res.data.followers ?? [];
    for (const actor of items) {
      actors.set(actor.did, {
        did: actor.did,
        handle: actor.handle,
        displayName: actor.displayName,
        avatar: actor.avatar,
      });
    }
    cursor = res.data.cursor;
    if (!cursor) break;
  }
  return actors;
}

function groupByFollowDirection(
  dids: Set<string>,
  followingMap: Map<string, FriendEntry>,
  followersMap: Map<string, FriendEntry>
): FriendGroups {
  const groups: FriendGroups = { moots: [], following: [], oomfs: [] };

  for (const did of dids) {
    const followedByUser = followingMap.has(did);
    const followsUser = followersMap.has(did);
    const entry = followingMap.get(did) ?? followersMap.get(did)!;

    if (followedByUser && followsUser) groups.moots.push(entry);
    else if (followedByUser) groups.following.push(entry);
    else groups.oomfs.push(entry);
  }

  return groups;
}

export class ProfileService {
  private agent: AtpAgent;

  constructor(
    private db: Database,
    private resolver: ProfileResolver,
    private logger: Logger,
    private atmosphere: AtmosphereService
  ) {
    this.agent = new AtpAgent({ service: "https://api.bsky.app" });
  }
  /* v8 ignore stop */

  /**
   * The settings a visitor is allowed to see. `uiLocale`, `defaultClient` and
   * `openProfilesInApp` are the viewer's own business, not the profile owner's,
   * so none of them is selected here. `atmosphereLinksEnabled` is the mirror
   * case: it governs what this account shows every visitor, so it belongs here.
   *
   * @see [profile-service.test.ts](../tests/profile-service.test.ts): "never
   * selects a setting that is private to its owner".
   */
  private readPubliclyVisibleSettings(did: string) {
    return this.db
      .selectFrom("user_settings")
      .select([
        "inboxEnabled",
        "customPrompt",
        "profileCardTheme",
        "touchpointLocale",
        "atmosphereLinksEnabled",
      ])
      .where("did", "=", did)
      .executeTakeFirst();
  }

  async getPublicProfile(did: string): Promise<{
    profile: Awaited<ReturnType<AtpAgent["getProfile"]>>["data"];
    exists: boolean;
    inboxEnabled: boolean;
    customPrompt: string | null;
    profileCardTheme: string | null;
    touchpointLocale: string | null;
    atmosphereApps: AtmosphereAppLink[];
  }> {
    let profileResponse: Awaited<ReturnType<typeof this.agent.getProfile>>;
    let exists: boolean;
    let publicSettings: Awaited<ReturnType<typeof this.readPubliclyVisibleSettings>>;
    let atmosphereApps: string[];

    try {
      // The repo scan runs alongside the settings read rather than after it, so
      // an opted-in account (the default, and so nearly all of them) does not
      // pay a database round trip before its PDS is even dialled. An opted-out
      // account discards the answer below.
      [profileResponse, exists, publicSettings, atmosphereApps] = await Promise.all([
        withRetry(() => this.agent.getProfile({ actor: did }), this.logger, {
          did,
          op: "getProfile",
        }),
        this.checkUserExists(did),
        this.readPubliclyVisibleSettings(did),
        this.atmosphere.presenceFor(did),
      ]);
    } catch (err) {
      this.logger.error({ err, did }, "Failed to fetch profile by DID");
      throw new Error("Failed to fetch profile", { cause: err });
    }

    if (!profileResponse.success) {
      throw new Error("Profile not found");
    }

    return {
      profile: profileResponse.data,
      exists,
      inboxEnabled: fromDbBoolean(publicSettings?.inboxEnabled, INBOX_OPEN_BY_DEFAULT),
      customPrompt: publicSettings?.customPrompt ?? null,
      profileCardTheme: publicSettings?.profileCardTheme ?? null,
      touchpointLocale: publicSettings?.touchpointLocale ?? null,
      atmosphereApps: fromDbBoolean(
        publicSettings?.atmosphereLinksEnabled,
        ATMOSPHERE_LINKS_ON_BY_DEFAULT
      )
        ? appLinksFor(atmosphereApps, profileResponse.data.handle, did)
        : NO_ATMOSPHERE_APPS,
    };
  }

  async checkUserExists(did: string): Promise<boolean> {
    try {
      const userExists = await this.db
        .selectFrom("user_profile")
        .select("did")
        .where("did", "=", did)
        .executeTakeFirst();
      return !!userExists;
    } catch (err) {
      this.logger.error({ err, did }, "Failed to check user existence by DID");
      throw new Error("Failed to check user existence", { cause: err });
    }
  }

  private async filterToRegisteredUsers(dids: Set<string>): Promise<Set<string>> {
    const appUsers = await this.db
      .selectFrom("user_profile")
      .select("did")
      .where("did", "in", [...dids])
      .execute();
    return new Set(appUsers.map((u) => u.did));
  }

  /**
   * Follows and followers both go through the public appview agent so the two
   * datasets come from one consistent indexing state — reading one through the
   * authenticated caller agent could observe the same relationship differently
   * and mislabel a moot as an oomf. Follows can't move to the authenticated
   * agent either: its OAuth scope grants getFollows but not getFollowers.
   */
  async getFriendsOnApp(userDid: string): Promise<FriendGroups> {
    const agent = this.agent;
    const [followingMap, followersMap] = await Promise.all([
      collectPagedActors((cursor) =>
        withRetry(
          () => agent.app.bsky.graph.getFollows({ actor: userDid, limit: 100, cursor }),
          this.logger,
          { did: userDid, op: "getFollows" }
        )
      ),
      collectPagedActors((cursor) =>
        withRetry(
          () => agent.app.bsky.graph.getFollowers({ actor: userDid, limit: 100, cursor }),
          this.logger,
          { did: userDid, op: "getFollowers" }
        )
      ),
    ]);

    const allDids = new Set([...followingMap.keys(), ...followersMap.keys()]);
    if (allDids.size === 0) return { moots: [], following: [], oomfs: [] };

    const registeredDids = await this.filterToRegisteredUsers(allDids);

    return groupByFollowDirection(registeredDids, followingMap, followersMap);
  }

  async checkFollowsBot(agent: Agent, botDid: string): Promise<boolean> {
    try {
      const res = await withRetry(() => agent.getProfile({ actor: botDid }), this.logger, {
        botDid,
        op: "getProfile",
      });
      if (!res.success) return false;
      return !!res.data.viewer?.following;
    } catch (err) {
      this.logger.error({ err, botDid }, "Failed to check bot follow status");
      return false;
    }
  }

  async searchActorsTypeahead(
    q: string
  ): Promise<{ did: string; handle: string; displayName?: string; avatar?: string }[]> {
    const res = await withRetry(
      () => this.agent.searchActorsTypeahead({ q, limit: 8 }),
      this.logger,
      {
        q,
        op: "searchActorsTypeahead",
      }
    );
    return res.data.actors.map((a) => ({
      did: a.did,
      handle: a.handle,
      displayName: a.displayName,
      avatar: a.avatar,
    }));
  }

  async resolveHandleToDid(handle: string): Promise<string> {
    let did: string | undefined;
    try {
      did = await this.resolver.resolveHandleToDid(handle);
    } catch (err) {
      this.logger.error({ err, handle }, "Error during handle resolution");
      throw new Error("Failed to resolve handle", { cause: err });
    }
    if (!did) {
      throw new Error("Handle not found");
    }
    return did;
  }
  /* v8 ignore next 1 */
}
