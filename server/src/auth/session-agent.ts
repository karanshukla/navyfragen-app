/* v8 ignore start */
import { Agent } from "@atproto/api";

import { getE2EAgent, type E2EAgent } from "./e2e-agent-store";

import type { AppContext } from "../index";

/**
 * Restores an AT Protocol Agent for an explicit DID.
 *
 * The OAuth tokens for every authenticated DID live in the `auth_session`
 * table (independent of the browser cookie), so an agent can be restored for
 * any remembered account — not just the currently active one. This is what
 * enables multi-account switching without a fresh OAuth round-trip.
 */
/* v8 ignore stop */
export async function initializeAgentForDid(
  ctx: AppContext,
  did: string
): Promise<E2EAgent | null> {
  // E2E sessions bypass OAuth — agent is stored in-process by the e2e login route.
  const e2eAgent = getE2EAgent(did);
  if (e2eAgent) {
    return e2eAgent;
  }

  try {
    const oauthSession = await ctx.oauthClient.restore(did);
    if (!oauthSession) {
      return null;
    }

    return new Agent(oauthSession);
  } catch (err) {
    ctx.logger.warn({ err, did }, "Failed to initialize agent for did");
    return null;
  }
}

/**
 * Restores the AT Protocol Agent for the session's currently active account.
 * Thin wrapper over {@link initializeAgentForDid} using `req.session.did`.
 */
/* v8 ignore next 1 */
export async function initializeAgentFromSession(
  req: Express.Request,
  ctx: AppContext
): Promise<E2EAgent | null> {
  if (!req.session?.did) {
    return null;
  }

  return initializeAgentForDid(ctx, req.session.did);
}
