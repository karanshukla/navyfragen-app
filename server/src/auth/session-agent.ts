/* v8 ignore start */
import { Agent } from "@atproto/api";

import { getE2EAgent, type E2EAgent } from "./e2e-agent-store";

import type { AppContext } from "../index";

/**
 * Takes an explicit DID rather than reading the cookie because `auth_session`
 * holds tokens for every authenticated DID — that is what lets the account
 * switcher restore any remembered account without a fresh OAuth round-trip.
 */
/* v8 ignore stop */
export async function initializeAgentForDid(
  ctx: AppContext,
  did: string
): Promise<E2EAgent | null> {
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
