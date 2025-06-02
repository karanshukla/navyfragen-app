import { Agent } from "@atproto/api";
import type { AppContext } from "../index";

/**
 * Initialize an authenticated agent for the current user session
 * this could likely replace agent-initializer.ts
 */
export async function initializeAgentFromSession(
  req: Express.Request,
  ctx: AppContext
): Promise<Agent | null> {
  if (!req.session?.did) {
    return null;
  }

  try {
    const oauthSession = await ctx.oauthClient.restore(req.session.did);
    if (!oauthSession) {
      return null;
    }

    return new Agent(oauthSession);
  } catch (err) {
    ctx.logger.warn(
      { err, did: req.session.did },
      "Failed to initialize agent from session"
    );
    return null;
  }
}
