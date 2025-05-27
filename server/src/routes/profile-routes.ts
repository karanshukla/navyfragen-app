import express from "express";
import { param, validationResult } from "express-validator";
import type { AppContext } from "../index";

export function profileRoutes(
  ctx: AppContext,
  handler: any,
  checkValidation: any
) {
  const router = express.Router();

  // Public profile for a DID
  router.get(
    "/public-profile/:did",
    param("did").isString().notEmpty().withMessage("DID required"),
    checkValidation,
    handler(async (req: express.Request, res: express.Response) => {
      const did = req.params.did;
      if (!did) {
        return res.status(400).json({ error: "DID required" });
      }
      try {
        const AtpAgent = require("@atproto/api").AtpAgent;
        const agent = new AtpAgent({ service: "https://api.bsky.app" });
        const profileResponse = await agent.getProfile({ actor: did });
        if (profileResponse.success) {
          return res.json({ profile: profileResponse.data });
        } else {
          return res.status(404).json({ error: "Profile not found" });
        }
      } catch (err) {
        return res.status(500).json({ error: "Failed to fetch profile" });
      }
    })
  );

  // Check if a DID exists
  router.get(
    "/user-exists/:did",
    param("did").isString().notEmpty().withMessage("DID required"),
    checkValidation,
    handler(async (req: express.Request, res: express.Response) => {
      const did = req.params.did;
      if (!did) {
        return res.status(400).json({ error: "DID required" });
      }
      const userExists = await ctx.db
        .selectFrom("auth_session")
        .select("key")
        .where("key", "=", did)
        .executeTakeFirst();
      return res.json({ exists: !!userExists });
    })
  );

  return router;
}
