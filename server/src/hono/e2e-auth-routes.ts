// Its own module so it can be excluded from the unit-coverage gate: it makes
// live network calls and DB writes, exercised by the Playwright overlay.

import { AtpAgent } from "@atproto/api";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { setE2EAgent } from "#/auth/e2e-agent-store";
import { env } from "#/lib/env";
import { errorBody } from "#/lib/errors";
import { AuthService } from "#/services/auth-service";
import { getSession, setSession } from "./session-middleware";

import type { AppContext } from "#/index";
import type { AppSessionData } from "#/auth/session";

export function createE2EAuthHono(ctx: AppContext, service: AuthService): Hono {
  const app = new Hono();

  app.post(
    "/auth/e2e-login",
    zValidator(
      "json",
      z.object({
        identifier: z.string().min(1).max(100),
        password: z.string().min(1).max(200),
      }),
      (r, c) => {
        if (!r.success) return c.json({ errors: r.error.issues }, 400);
      }
    ),
    async (c) => {
      // Defense in depth: refuse even if the route was somehow mounted in production.
      if (env.NODE_ENV === "production") {
        ctx.logger.error("E2E login attempted in production — request blocked");
        return c.json(
          errorBody("E2E_LOGIN_UNAVAILABLE", "E2E login is not available in production"),
          403
        );
      }
      const { identifier, password } = c.req.valid("json");
      const agent = new AtpAgent({ service: env.E2E_PDS_URL });
      await agent.login({ identifier, password });
      const did = agent.session?.did;
      if (!did) {
        return c.json(errorBody("E2E_LOGIN_NO_DID", "Login failed: no session DID returned"), 401);
      }
      await ctx.db
        .insertInto("auth_session")
        .values({ key: did, session: "e2e" })
        .onConflict((oc) => oc.column("key").doUpdateSet({ session: "e2e" }))
        .execute();
      await service.createOrConfirmUserProfile(did);
      const handle = agent.session?.handle || identifier;
      setE2EAgent(did, agent, handle);
      const existing = getSession(c) ?? ({} as AppSessionData);
      await setSession(c, { ...existing, did });
      ctx.logger.info({ did }, "E2E login successful");
      return c.json({ success: true });
    }
  );

  return app;
}
