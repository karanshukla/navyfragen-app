import { AtpAgent } from "@atproto/api";
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
  async resolveHandleToDid(handle: string): Promise<string> {
    try {
      const did = await this.resolver.resolveHandleToDid(handle);
      if (!did) {
        throw new Error("Handle not found");
      }
      return did;
    } catch (err) {
      this.logger.error({ err, handle }, "Failed to resolve handle");
      throw new Error("Failed to resolve handle");
    }
  }
}
