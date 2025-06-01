import type { AppContext } from "../index";
import { AtpAgent, type AtpSessionData } from "@atproto/api"; // Added AtpSessionData import
import type { OAuthSession, TokenInfo } from "@atproto/oauth-client"; // Added TokenInfo import
// RequestInit, Response, URL, Headers are typically available globally

export async function initializeAuthenticatedAgent(
  rawTokenValue: string | undefined,
  ctx: AppContext
): Promise<{
  agent: AtpAgent;
  userSessionDid: string;
  sessionExists: boolean;
} | null> {
  let did: string | null = null;
  let sessionExistsInDb = false;

  if (!rawTokenValue) {
    ctx.logger.info("No token provided for agent initialization.");
    return null;
  }

  try {
    did = Buffer.from(rawTokenValue, "base64").toString("ascii");
  } catch (err) {
    ctx.logger.warn(
      { error: err, token: rawTokenValue },
      "Failed to decode token (DID)."
    );
    return null;
  }

  // Check if session exists in DB before attempting restore
  const dbSession = await ctx.db
    .selectFrom("auth_session")
    .selectAll()
    .where("key", "=", did)
    .executeTakeFirst();

  if (!dbSession) {
    sessionExistsInDb = false;
    // Optionally, you might want to return early if no DB session exists,
    // depending on desired behavior (e.g., if restore shouldn't be attempted).
    // For now, we'll proceed to attempt restore, as oauthClient might have an in-memory session
    // or the session store for oauthClient might be different.
    ctx.logger.info(
      { did },
      "No session found in DB for the given DID. Attempting restore anyway."
    );
  } else {
    sessionExistsInDb = true;
  }

  try {
    const restoredOAuthSession: OAuthSession | undefined =
      await ctx.oauthClient.restore(did);

    if (!restoredOAuthSession) {
      ctx.logger.warn(
        { did },
        "OAuth session restoration (ctx.oauthClient.restore) returned undefined."
      );
      return {
        agent: null,
        userSessionDid: null,
        sessionExists: sessionExistsInDb,
      } as any; // Will be caught by null check later
    }

    const tokenInfo = await restoredOAuthSession.getTokenInfo();

    if (!tokenInfo || !tokenInfo.aud || !tokenInfo.sub) {
      ctx.logger.warn(
        {
          didFromToken: did,
          tokenInfoAud: tokenInfo?.aud,
          tokenInfoSub: tokenInfo?.sub,
        },
        "Critical information (audience or subject) missing from tokenInfo after OAuth restore."
      );
      return {
        agent: null,
        userSessionDid: null,
        sessionExists: sessionExistsInDb,
      } as any;
    }

    const pdsUrlForAgent = tokenInfo.aud.endsWith("/")
      ? tokenInfo.aud.slice(0, -1)
      : tokenInfo.aud;
    const userSessionDidFromToken = tokenInfo.sub;
    // accessJwt and refreshJwt should be sourced from the OAuthSession's internal state
    // or a method that explicitly provides them if available. The custom fetchHandler
    // is meant to manage token injection and refresh, so direct access might not be needed
    // for resumeSession if the fetchHandler is robust.
    // For resumeSession, we need to provide what the AtpAgent expects.
    // Let's assume the oauthClient itself can provide the necessary JWTs or the fetchHandler handles it.

    const atpAgentFetchHandler = async (
      input: string | URL | Request,
      init?: RequestInit
    ): Promise<Response> => {
      let requestUrl: URL;
      let finalInit: RequestInit = init || {};

      if (input instanceof Request) {
        requestUrl = new URL(input.url);
        if (!init) {
          finalInit.method = input.method;
          finalInit.headers = new Headers(input.headers);
          if (input.body && input.method !== "GET" && input.method !== "HEAD") {
            finalInit.body = input.body;
          }
        }
      } else {
        requestUrl = new URL(String(input));
      }

      if (requestUrl.origin !== pdsUrlForAgent) {
        ctx.logger.error(
          {
            requestOrigin: requestUrl.origin,
            expectedPds: pdsUrlForAgent,
          },
          "AtpAgent request to unexpected origin."
        );
        throw new Error(
          `Request to ${requestUrl.origin} is outside the scope of PDS ${pdsUrlForAgent}`
        );
      }

      const pathnameForOAuthHandler =
        requestUrl.pathname + requestUrl.search + requestUrl.hash;

      // If the request has a body, Node's fetch (undici) requires the 'duplex' option.
      if (finalInit.body) {
        (finalInit as any).duplex = "half";
      }

      return restoredOAuthSession.fetchHandler(
        pathnameForOAuthHandler,
        finalInit
      );
    };

    const agent = new AtpAgent({
      service: pdsUrlForAgent,
      fetch: atpAgentFetchHandler,
    });

    // Attempt to resume session with available data
    // This is the crucial part to make the agent "aware" of the session
    // for its internal checks.

    // Placeholder JWTs are acceptable here because the atpAgentFetchHandler,
    // which uses restoredOAuthSession.fetchHandler, is responsible for the actual
    // token management (injection and refresh).
    const placeholderJwt = "placeholder-for-sdk-session-init";

    const initialSessionData: AtpSessionData = {
      did: userSessionDidFromToken,
      handle: userSessionDidFromToken, // Initial placeholder, will be updated after getProfile
      accessJwt: placeholderJwt, // Placeholder
      refreshJwt: placeholderJwt, // Placeholder
      active: true, // Added to satisfy AtpSessionData type
      // email: undefined, // Optional: if you have email and AtpSessionData supports it
    };
    await agent.resumeSession(initialSessionData);

    try {
      const profile = await agent.app.bsky.actor.getProfile({
        actor: userSessionDidFromToken,
      });

      if (!profile?.data?.did || profile.data.did !== userSessionDidFromToken) {
        ctx.logger.warn(
          {
            didFromToken: did,
            sessionDidFromTokenInfo: userSessionDidFromToken,
            profileDid: profile?.data?.did,
          },
          "Agent validation (getProfile) returned mismatched DID or no DID."
        );
        return {
          agent: null,
          userSessionDid: null,
          sessionExists: sessionExistsInDb,
        } as any;
      }

      // Update session with the fetched handle if available
      if (agent.session) {
        // Ensure session exists before trying to spread it
        await agent.resumeSession({
          ...agent.session,
          handle: profile.data.handle || userSessionDidFromToken, // Use fetched handle or fallback
        });
      } else {
        ctx.logger.warn(
          { did: userSessionDidFromToken },
          "Agent session was not defined before attempting to update handle after profile fetch. The handle in the agent's session might be stale."
        );
        // If agent.session is undefined here, it implies the first resumeSession might have had issues
        // not caught, or the SDK behaves unexpectedly. For now, we log and proceed.
        // The agent might still function via its custom fetch handler.
      }

      ctx.logger.info(
        {
          did: userSessionDidFromToken,
          handle: profile.data.handle,
          agentService: agent.service.toString(),
        },
        "AtpAgent successfully initialized and validated in agent-initializer."
      );
      return {
        agent,
        userSessionDid: userSessionDidFromToken,
        sessionExists: sessionExistsInDb,
      };
    } catch (validationErr) {
      ctx.logger.warn(
        {
          error: validationErr,
          didFromToken: did,
          sessionDid: userSessionDidFromToken,
        },
        "Agent validation (getProfile) failed in agent-initializer."
      );
      return {
        agent: null,
        userSessionDid: null,
        sessionExists: sessionExistsInDb,
      } as any;
    }
  } catch (restoreErr) {
    ctx.logger.error(
      { error: restoreErr, did },
      "Error during OAuth session restoration or AtpAgent initialization in agent-initializer."
    );
    return {
      agent: null,
      userSessionDid: null,
      sessionExists: sessionExistsInDb,
    } as any;
  }
}
