import { isValidHandle } from "@atproto/syntax";
import { OAuthResolverError } from "@atproto/oauth-client-node";
import { env } from "../lib/env";
import { initializeAgentFromSession } from "../auth/session-agent";
import type { AppContext } from "../index";
import type { Record as BskyProfileRecord } from "../lexicon/types/app/bsky/actor/profile";
import Cryptr from "cryptr";

export class AuthService {
  constructor(private ctx: AppContext) {}

  async getOAuthRedirectUrl(handle: string) {
    if (typeof handle !== "string" || !isValidHandle(handle)) {
      throw new Error("invalid handle");
    }
    try {
      const url = await this.ctx.oauthClient.authorize(handle, {
        scope: "atproto transition:generic",
      });
      return url.toString();
    } catch (err) {
      if (err instanceof OAuthResolverError) throw new Error(err.message);
      throw new Error("couldn't initiate login");
    }
  }

  async revokeSession(did: string) {
    await this.ctx.oauthClient.revoke(did);
  }

  async checkSession(did: string, req: any) {
    const dbSession = await this.ctx.db
      .selectFrom("auth_session")
      .selectAll()
      .where("key", "=", did)
      .executeTakeFirst();
    if (!dbSession) return null;
    const agent = await initializeAgentFromSession(req, this.ctx);
    if (!agent) return null;
    const response = await agent.getProfile({ actor: did });
    const data = response?.data as BskyProfileRecord;
    if (!data) return null;
    return {
      did: data.did,
      handle: data.handle,
      displayName: data.displayName || "",
      description: data.description || "",
      avatar: data.avatar || undefined,
      banner: data.banner || undefined,
      createdAt: data.createdAt,
    };
  }

  async createOrConfirmUserProfile(did: string) {
    await this.ctx.db
      .insertInto("user_profile")
      .values({ did, createdAt: new Date().toISOString() })
      .onConflict((oc: any) => oc.column("did").doNothing())
      .execute();
  }

  encryptDid(did: string) {
    const secret = env.OAUTH_TOKEN_SECRET;
    if (!secret) throw new Error("OAUTH_TOKEN_SECRET is not set");
    const cryptr = new Cryptr(secret);
    return encodeURIComponent(cryptr.encrypt(did));
  }

  decryptDid(token: string) {
    const secret = env.OAUTH_TOKEN_SECRET;
    if (!secret) throw new Error("OAUTH_TOKEN_SECRET is not set");
    const cryptr = new Cryptr(secret);
    return cryptr.decrypt(token);
  }

  async findUserByDid(did: string) {
    return await this.ctx.db
      .selectFrom("user_profile")
      .selectAll()
      .where("did", "=", did)
      .executeTakeFirst();
  }
}
