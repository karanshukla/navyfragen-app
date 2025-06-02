import type { AppContext } from "../index";
import { Agent } from "@atproto/api";

export async function getAuthenticatedUserAndInitializeAgent(
  rawTokenValue: string,
  ctx: AppContext
): Promise<{ agent: Agent | null; userSessionDid: string | null }> {
  let agent: Agent | null = null;
  let userSessionDid: string | null = null;
  let sessionExistsInDb = false;
  const agentInitResult = await initializeAuthenticatedAgent(
    rawTokenValue,
    ctx
  );
  if (agentInitResult) {
    agent = agentInitResult.agent;
    userSessionDid = agentInitResult.userSessionDid;
    sessionExistsInDb = agentInitResult.sessionExists;
  } else {
    let decodedDidForError: string | null = null;
    try {
      decodedDidForError = Buffer.from(rawTokenValue, "base64").toString(
        "ascii"
      );
      const dbSession = await ctx.db
        .selectFrom("auth_session")
        .selectAll()
        .where("key", "=", decodedDidForError)
        .executeTakeFirst();
      sessionExistsInDb = !!dbSession;
    } catch (e) {
      // Do nothing
    }
  }

  // Check agent AND userSessionDid validity before proceeding
  if (!agent || !userSessionDid) {
    let errorMsg = "Not authenticated or agent initialization failed.";
    if (rawTokenValue && !sessionExistsInDb) {
      errorMsg =
        "Session for this user was deleted, expired, or invalid. Please log in again.";
    }
    
    throw new Error(errorMsg);
  }
  return {
    agent,
    userSessionDid,
  };
}

export async function initializeAuthenticatedAgent(
  rawTokenValue: string | undefined,
  ctx: AppContext
): Promise<{
  agent: Agent;
  userSessionDid: string;
  sessionExists: boolean;
} | null> {
  if (!rawTokenValue) {
    ctx.logger.info("No token provided for agent initialization.");
    return null;
  }

  let did: string;
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
  const sessionExistsInDb = !!dbSession;

  let session: any;
  try {
    session = await ctx.oauthClient.restore(did);
    if (!session) {
      ctx.logger.warn({ did }, "OAuth session restoration returned undefined.");
      return null;
    }
  } catch (err) {
    ctx.logger.error(
      { error: err, did },
      "Error during OAuth session restoration."
    );
    return null;
  }

  // The session object from the OAuth client is already an authenticated agent
  // (see docs: https://github.com/bluesky-social/atproto/tree/main/packages/oauth-client-node)
  // You can use it directly:
  const agent = new Agent(session);
  const userSessionDid = agent.did ?? did;

  try {
    const profile = await agent.getProfile({ actor: userSessionDid });
    if (!profile?.data?.did || profile.data.did !== userSessionDid) {
      ctx.logger.warn(
        { did, sessionDid: userSessionDid, profileDid: profile?.data?.did },
        "Agent validation (getProfile) returned mismatched DID or no DID."
      );
      return null;
    }
  } catch (err) {
    ctx.logger.warn(
      { error: err, did, sessionDid: userSessionDid },
      "Agent validation (getProfile) failed."
    );
    return null;
  }

  ctx.logger.info(
    { did: userSessionDid },
    "Agent successfully initialized and validated."
  );
  return {
    agent,
    userSessionDid,
    sessionExists: sessionExistsInDb,
  };
}
