/* v8 ignore start */
import { OAuthResolverError } from "@atproto/oauth-client-node";
import { isValidHandle } from "@atproto/syntax";
import Cryptr from "cryptr";

import { deleteE2EAgent, getE2EHandle, hasE2EAgent } from "../auth/e2e-agent-store";
import { initializeAgentFromSession } from "../auth/session-agent";
import { env } from "../lib/env";

import type { AppContext } from "../index";
import type { AppBskyActorDefs } from "@atproto/api";

export class AuthService {
  constructor(private ctx: AppContext) {}
  /* v8 ignore stop */

  async getOAuthRedirectUrl(handle: string) {
    if (typeof handle !== "string" || !isValidHandle(handle)) {
      throw new Error("invalid handle");
    }
    try {
      const url = await this.ctx.oauthClient.authorize(handle, {
        scope:
          "atproto repo:app.bsky.feed.post repo:app.navyfragen.message blob:image/* rpc:app.bsky.actor.getProfile?aud=* rpc:app.bsky.graph.getFollows?aud=*",
      });
      return url.toString();
    } catch (err: any) {
      this.ctx.logger.error(
        { handle, err: err?.message, stack: err?.stack },
        "[oauth] oauthClient.authorize threw"
      );
      if (err instanceof OAuthResolverError) throw new Error(err.message, { cause: err });
      throw new Error("couldn't initiate login", { cause: err });
    }
  }

  async revokeSession(did: string) {
    /* v8 ignore next 6 */
    if (hasE2EAgent(did)) {
      deleteE2EAgent(did);
      await this.ctx.db.deleteFrom("auth_session").where("key", "=", did).execute();
      return;
    }
    await this.ctx.oauthClient.revoke(did);
  }

  async checkSession(did: string, req: any) {
    const dbSession = await this.ctx.db
      .selectFrom("auth_session")
      .selectAll()
      .where("key", "=", did)
      .executeTakeFirst();
    if (!dbSession) return null;

    /* v8 ignore next 8 */
    if (hasE2EAgent(did)) {
      const handle = getE2EHandle(did) || did;
      return {
        did,
        handle,
        displayName: handle,
        description: "",
        avatar: undefined,
        banner: undefined,
        createdAt: undefined,
      };
    }

    const agent = await initializeAgentFromSession(req, this.ctx);
    if (!agent) return null;
    /* v8 ignore next 12 */
    const response = await agent.getProfile({ actor: did });
    const data = response?.data as AppBskyActorDefs.ProfileViewDetailed;
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
    /* v8 ignore next 1 */
    if (!secret) throw new Error("OAUTH_TOKEN_SECRET is not set");
    const cryptr = new Cryptr(secret);
    return encodeURIComponent(cryptr.encrypt(did));
  }

  decryptDid(token: string) {
    const secret = env.OAUTH_TOKEN_SECRET;
    /* v8 ignore next 1 */
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
  /* v8 ignore next 1 */
}
