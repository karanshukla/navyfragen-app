/* v8 ignore start */
import { Agent } from "@atproto/api";

import { getE2EAgent } from "./e2e-agent-store";

import type { AppContext } from "../index";

export async function initializeAgentFromSession(
  req: Express.Request,
  ctx: AppContext
): Promise<Agent | null> {
  /* v8 ignore stop */
  if (!req.session?.did) {
    return null;
  }

  // E2E sessions bypass OAuth — agent is stored in-process by the e2e login route.
  const e2eAgent = getE2EAgent(req.session.did);
  if (e2eAgent) {
    return e2eAgent;
  }

  try {
    const oauthSession = await ctx.oauthClient.restore(req.session.did);
    if (!oauthSession) {
      return null;
    }

    return new Agent(oauthSession);
  } catch (err) {
    ctx.logger.warn({ err, did: req.session.did }, "Failed to initialize agent from session");
    return null;
  }
}
