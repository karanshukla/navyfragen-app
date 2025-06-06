import express from "express";
import { param } from "express-validator";
import type { AppContext } from "../index";
import { AtpAgent } from "@atproto/api";

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
        const agent = new AtpAgent({ service: "https://api.bsky.app" });
        const profileResponse = await agent.getProfile({ actor: did });
        if (profileResponse.success) {
          // Attempt to resolve DID to handle for convenience, but don't fail if it doesn't resolve
          let handle = did;
          try {
            const resolvedHandle = await ctx.resolver.resolveDidToHandle(did);
            if (resolvedHandle) {
              handle = resolvedHandle;
            }
          } catch (resolveError) {
            ctx.logger.warn(
              { err: resolveError, did },
              "Failed to resolve DID to handle for public profile, using DID as fallback"
            );
          }
          return res.json({
            profile: profileResponse.data,
            did,
            handle,
          }); // Return profile, DID, and resolved handle
        } else {
          return res.status(404).json({ error: "Profile not found" });
        }
      } catch (err) {
        ctx.logger.error({ err, did }, "Failed to fetch profile by DID");
        return res.status(500).json({ error: "Failed to fetch profile" });
      }
    })
  );

  router.get(
    "/user-exists/:did",
    param("did").isString().notEmpty().withMessage("DID required"),
    checkValidation,
    handler(async (req: express.Request, res: express.Response) => {
      const did = req.params.did;
      if (!did) {
        return res.status(400).json({ error: "DID required" });
      }
      try {
        const userExists = await ctx.db
          .selectFrom("user_profile")
          .select("did")
          .where("did", "=", did)
          .executeTakeFirst();
        return res.json({ exists: !!userExists, did });
      } catch (err) {
        ctx.logger.error(
          { err, did }, // Log with DID
          "Failed to check user existence by DID"
        );
        return res
          .status(500)
          .json({ error: "Failed to check user existence" });
      }
    })
  );

  router.get(
    "/resolve-handle/:handle",
    param("handle").isString().notEmpty().withMessage("Handle required"),
    checkValidation,
    handler(async (req: express.Request, res: express.Response) => {
      const handle = req.params.handle;
      if (!handle) {
        return res.status(400).json({ error: "Handle required" });
      }
      try {
        const did = await ctx.resolver.resolveHandleToDid(handle);
        if (did) {
          return res.json({ did });
        } else {
          return res.status(404).json({ error: "Handle not found" });
        }
      } catch (err) {
        ctx.logger.error({ err, handle }, "Failed to resolve handle");
        return res.status(500).json({ error: "Failed to resolve handle" });
      }
    })
  );

  return router;
}
