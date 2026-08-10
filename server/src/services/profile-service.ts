/* v8 ignore start */
import { AtpAgent, Agent } from "@atproto/api";
import { Logger } from "pino";

import type { Database } from "../database/db";
import { fromDbBoolean } from "../lib/db-boolean";

export interface ProfileResolver {
  resolveDidToHandle(did: string): Promise<string | undefined>;
  resolveHandleToDid(handle: string): Promise<string | undefined>;
}

const INBOX_OPEN_BY_DEFAULT = true;
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
    private logger: Logger
  ) {
    this.agent = new AtpAgent({ service: "https://api.bsky.app" });
  }
  /* v8 ignore stop */

  private readPubliclyVisibleSettings(did: string) {
    return this.db
      .selectFrom("user_settings")
      .select(["inboxEnabled", "customPrompt", "profileCardTheme", "touchpointLocale"])
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
  }> {
    let profileResponse: Awaited<ReturnType<typeof this.agent.getProfile>>;
    let exists: boolean;
    let publicSettings: Awaited<ReturnType<typeof this.readPubliclyVisibleSettings>>;

    try {
      [profileResponse, exists, publicSettings] = await Promise.all([
        this.agent.getProfile({ actor: did }),
        this.checkUserExists(did),
        this.readPubliclyVisibleSettings(did),
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
        agent.app.bsky.graph.getFollows({ actor: userDid, limit: 100, cursor })
      ),
      collectPagedActors((cursor) =>
        agent.app.bsky.graph.getFollowers({ actor: userDid, limit: 100, cursor })
      ),
    ]);

    const allDids = new Set([...followingMap.keys(), ...followersMap.keys()]);
    if (allDids.size === 0) return { moots: [], following: [], oomfs: [] };

    const registeredDids = await this.filterToRegisteredUsers(allDids);

    return groupByFollowDirection(registeredDids, followingMap, followersMap);
  }

  async checkFollowsBot(agent: Agent, botDid: string): Promise<boolean> {
    try {
      const res = await agent.getProfile({ actor: botDid });
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
    const res = await this.agent.searchActorsTypeahead({ q, limit: 8 });
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
