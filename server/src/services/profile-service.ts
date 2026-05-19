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

  /**
   * Get public profile information for a given DID
   * @param did The user's DID
   * @returns The user's public profile with DID and handle
   */
  async getPublicProfile(did: string): Promise<{
    profile: any;
    did: string;
    handle: string;
  }> {
    try {
      const profileResponse = await this.agent.getProfile({ actor: did });
      if (!profileResponse.success) {
        throw new Error("Profile not found");
      }

      // Attempt to resolve DID to handle for convenience
      let handle = did;
      try {
        const resolvedHandle = await this.resolver.resolveDidToHandle(did);
        if (resolvedHandle) {
          handle = resolvedHandle;
        }
      } catch (resolveError) {
        this.logger.warn(
          { err: resolveError, did },
          "Failed to resolve DID to handle for public profile, using DID as fallback"
        );
      }

      return {
        profile: profileResponse.data,
        did,
        handle,
      };
    } catch (err) {
      this.logger.error({ err, did }, "Failed to fetch profile by DID");
      throw new Error("Failed to fetch profile");
    }
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
      throw new Error("Failed to check user existence");
    }
  }

  /**
   * Resolve a handle to a DID
   * @param handle The user's handle
   * @returns The resolved DID
   */
  async getFriendsOnApp(
    userDid: string,
    agent: Agent
  ): Promise<{ did: string; handle: string; displayName?: string; avatar?: string }[]> {
    const followed: { did: string; handle: string; displayName?: string; avatar?: string }[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < 5; page++) {
      const res = await agent.app.bsky.graph.getFollows({
        actor: userDid,
        limit: 100,
        cursor,
      });
      if (!res.success) break;

      for (const f of res.data.follows) {
        followed.push({ did: f.did, handle: f.handle, displayName: f.displayName, avatar: f.avatar });
      }

      cursor = res.data.cursor;
      if (!cursor) break;
    }

    if (followed.length === 0) return [];

    const dids = followed.map((f) => f.did);
    const appUsers = await this.db
      .selectFrom("user_profile")
      .select("did")
      .where("did", "in", dids)
      .execute();

    const appUserDids = new Set(appUsers.map((u) => u.did));
    return followed.filter((f) => appUserDids.has(f.did));
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

  async resolveHandleToDid(handle: string): Promise<string> {
    let did: string | undefined;
    try {
      did = await this.resolver.resolveHandleToDid(handle);
    } catch (err) {
      this.logger.error({ err, handle }, "Error during handle resolution");
      throw new Error("Failed to resolve handle");
    }
    if (!did) {
      throw new Error("Handle not found");
    }
    return did;
  }
}
