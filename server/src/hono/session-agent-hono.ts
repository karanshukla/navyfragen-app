import { initializeAgentForDid } from "#/auth/session-agent";
import { getSession } from "./session-middleware";

import type { Context } from "hono";
import type { AppContext } from "#/index";
import type { E2EAgent } from "#/auth/e2e-agent-store";

export async function initializeAgentFromHonoSession(
  c: Context,
  ctx: AppContext
): Promise<E2EAgent | null> {
  const session = getSession(c);
  if (!session?.did) return null;
  return initializeAgentForDid(ctx, session.did);
}
