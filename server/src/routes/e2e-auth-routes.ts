/* v8 ignore start */

// E2E-only login route using AT Protocol app passwords.
// Only mounted when E2E_TESTING=true — never active in production.
import { AtpAgent } from "@atproto/api";
import express from "express";
import { body } from "express-validator";

import { setE2EAgent } from "../auth/e2e-agent-store";
import { env } from "../lib/env";
import { AuthService } from "../services/auth-service";

import type { AppContext } from "../index";

export function e2eAuthRoutes(
  ctx: AppContext,
  handler: (fn: express.Handler) => express.Handler,
  checkValidation: express.RequestHandler
) {
  const router = express.Router();
  const authService = new AuthService(ctx);

  router.post(
    "/auth/e2e-login",
    body("identifier").isString().isLength({ min: 1, max: 100 }).withMessage("identifier required"),
    body("password").isString().isLength({ min: 1, max: 200 }).withMessage("password required"),
    checkValidation,
    handler(async (req: express.Request, res: express.Response) => {
      // Defense in depth: refuse even if the route was somehow mounted in production.
      if (env.NODE_ENV === "production") {
        ctx.logger.error("E2E login attempted in production — request blocked");
        return res.status(403).json({ error: "E2E login is not available in production" });
      }

      const { identifier, password } = req.body as { identifier: string; password: string };

      const agent = new AtpAgent({ service: env.E2E_PDS_URL });
      await agent.login({ identifier, password });

      const did = agent.session?.did;
      if (!did) {
        return res.status(401).json({ error: "Login failed: no session DID returned" });
      }

      // Insert a sentinel auth_session row so checkSession's existence query passes.
      await ctx.db
        .insertInto("auth_session")
        .values({ key: did, session: "e2e" })
        .onConflict((oc) => oc.column("key").doUpdateSet({ session: "e2e" }))
        .execute();

      await authService.createOrConfirmUserProfile(did);

      const handle = agent.session?.handle || identifier;
      setE2EAgent(did, agent, handle);
      // Preserve any previously remembered accounts (multi-account add flow).
      req.session = req.session ?? {};
      req.session.did = did;

      ctx.logger.info({ did }, "E2E login successful");
      return res.json({ success: true });
    })
  );

  return router;
}

/* v8 ignore stop */
