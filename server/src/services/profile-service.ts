/* v8 ignore start */
import { AtpAgent, Agent } from "@atproto/api";
import { Kysely } from "kysely";
import { Logger } from "pino";

export interface ProfileResolver {
  resolveDidToHandle(did: string): Promise<string | undefined>;
  resolveHandleToDid(handle: string): Promise<string | undefined>;
}

export class ProfileService {
  private agent: AtpAgent;

  constructor(
    private db: Kysely<any>,
    private resolver: ProfileResolver,
    private logger: Logger
  ) {
    this.agent = new AtpAgent({ service: "https://api.bsky.app" });
  }
  /* v8 ignore stop */

  /**
   * Get public profile information for a given DID
   * @param did The user's DID
   * @returns The user's public profile and whether they're registered on Navyfragen
   */
  async getPublicProfile(did: string): Promise<{
    profile: any;
    exists: boolean;
  }> {
    let profileResponse: Awaited<ReturnType<typeof this.agent.getProfile>>;
    let exists: boolean;

    try {
      [profileResponse, exists] = await Promise.all([
        this.agent.getProfile({ actor: did }),
        this.checkUserExists(did),
      ]);
    } catch (err) {
      this.logger.error({ err, did }, "Failed to fetch profile by DID");
      throw new Error("Failed to fetch profile", { cause: err });
    }

    if (!profileResponse.success) {
      throw new Error("Profile not found");
    }

    return { profile: profileResponse.data, exists };
  }

  /**
   * Check if a user exists in the database
   * @param did The user's DID
   * @returns Whether the user exists
   */
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

  /**
   * Resolve a handle to a DID
   * @param handle The user's handle
   * @returns The resolved DID
   */
  async getFriendsOnApp(userDid: string): Promise<{
    moots: { did: string; handle: string; displayName?: string; avatar?: string }[];
    following: { did: string; handle: string; displayName?: string; avatar?: string }[];
    oomfs: { did: string; handle: string; displayName?: string; avatar?: string }[];
  }> {
    type FriendEntry = { did: string; handle: string; displayName?: string; avatar?: string };

    async function fetchPages(
      fetcher: (cursor: string | undefined) => Promise<{
        success: boolean;
        data: { follows?: FriendEntry[]; followers?: FriendEntry[]; cursor?: string };
      }>
    ): Promise<Map<string, FriendEntry>> {
      const map = new Map<string, FriendEntry>();
      let cursor: string | undefined;
      for (let page = 0; page < 5; page++) {
        const res = await fetcher(cursor);
        if (!res.success) break;
        const items = res.data.follows ?? res.data.followers ?? [];
        for (const f of items) {
          map.set(f.did, {
            did: f.did,
            handle: f.handle,
            displayName: f.displayName,
            avatar: f.avatar,
          });
        }
        cursor = res.data.cursor;
        if (!cursor) break;
      }
      return map;
    }

    // Both calls go through the same public appview agent so the follows and
    // followers datasets are read from one consistent indexing state. Splitting
    // them across the authenticated caller agent and this public agent could
    // observe the same relationship differently (one appview session lagging
    // the other), which mislabels moots as oomfs. Note we can't move follows to
    // the authenticated agent instead: its OAuth scope grants getFollows but not
    // getFollowers, so doing so would break getFollowers for existing sessions.
    const agent = this.agent;
    const [followingMap, followersMap] = await Promise.all([
      fetchPages((cursor) =>
        agent.app.bsky.graph.getFollows({ actor: userDid, limit: 100, cursor })
      ),
      fetchPages((cursor) =>
        agent.app.bsky.graph.getFollowers({ actor: userDid, limit: 100, cursor })
      ),
    ]);

    const allDids = new Set([...followingMap.keys(), ...followersMap.keys()]);
    if (allDids.size === 0) return { moots: [], following: [], oomfs: [] };

    const appUsers = await this.db
      .selectFrom("user_profile")
      .select("did")
      .where("did", "in", [...allDids])
      .execute();

    const appUserDids = new Set(appUsers.map((u) => u.did));

    const moots: FriendEntry[] = [];
    const following: FriendEntry[] = [];
    const oomfs: FriendEntry[] = [];

    for (const did of appUserDids) {
      const inFollowing = followingMap.has(did);
      const inFollowers = followersMap.has(did);
      const entry = followingMap.get(did) ?? followersMap.get(did)!;
      if (inFollowing && inFollowers) {
        moots.push(entry);
      } else if (inFollowing) {
        following.push(entry);
      } else {
        oomfs.push(entry);
      }
    }

    return { moots, following, oomfs };
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
