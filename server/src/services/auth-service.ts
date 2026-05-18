import { isValidHandle } from "@atproto/syntax";
import { OAuthResolverError } from "@atproto/oauth-client-node";
import { env } from "../lib/env";
import { initializeAgentFromSession } from "../auth/session-agent";
import type { AppContext } from "../index";
import type { AppBskyActorDefs } from "@atproto/api";
import Cryptr from "cryptr";

export class AuthService {
  constructor(private ctx: AppContext) {}

  async getOAuthRedirectUrl(handle: string) {
    if (typeof handle !== "string" || !isValidHandle(handle)) {
      throw new Error("invalid handle");
    }

    // Log the exact client metadata so env misconfiguration is immediately visible
    const meta = this.ctx.oauthClient.clientMetadata;
    this.ctx.logger.info(
      {
        handle,
        clientId: meta.client_id,
        redirectUris: meta.redirect_uris,
        clientUri: meta.client_uri,
      },
      "[oauth] authorize start — client metadata"
    );

    try {
      const start = Date.now();
      const timeoutMs = 15_000;
      const url = await Promise.race([
        this.ctx.oauthClient.authorize(handle, {
          scope: "atproto transition:generic",
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`authorize timed out after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);
      this.ctx.logger.info(
        { handle, durationMs: Date.now() - start, url: url.toString() },
        "[oauth] oauthClient.authorize completed"
      );
      return url.toString();
    } catch (err: any) {
      // FetchResponseError carries a `response` with the URL that returned unexpected content
      const responseUrl = err?.response?.url ?? err?.cause?.response?.url ?? null;
      const responseStatus = err?.response?.status ?? err?.cause?.response?.status ?? null;
      const responseContentType =
        err?.response?.headers?.get?.("content-type") ??
        err?.cause?.response?.headers?.get?.("content-type") ??
        null;

      this.ctx.logger.error(
        {
          handle,
          errMessage: err?.message,
          errName: err?.name,
          // Which URL returned HTML instead of JSON
          responseUrl,
          responseStatus,
          responseContentType,
          stack: err?.stack,
        },
        "[oauth] oauthClient.authorize threw"
      );
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
