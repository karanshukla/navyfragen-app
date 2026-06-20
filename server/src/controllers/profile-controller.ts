/* v8 ignore start */
import express from "express";
import { param } from "express-validator";
import { Logger } from "pino";

import { ProfileService } from "../services/profile-service";

import type { AppContext } from "../index";

import { initializeAgentFromSession } from "#/auth/session-agent";

const BOT_DID = "did:plc:3d4awubjiftylwrhhyp5vl7i";

export class ProfileController {
  constructor(
    private profileService: ProfileService,
    private logger: Logger,
    private ctx: AppContext
  ) {}
  /* v8 ignore stop */

  /**
   * Validation for public profile request
   */
  validateGetPublicProfile = [param("did").isString().notEmpty().withMessage("DID required")];

  /**
   * Get public profile for a DID
   */
  getPublicProfile = async (
    req: express.Request,
    res: express.Response
  ): Promise<express.Response> => {
    const did = req.params.did;

    try {
      const profileData = await this.profileService.getPublicProfile(did);
      return res.json(profileData);
    } catch (err: any) {
      if (err.message === "Profile not found") {
        return res.status(404).json({ error: "Profile not found" });
      }
      this.logger.error({ err, did }, "Failed to fetch public profile");
      return res.status(500).json({ error: "Failed to fetch profile" });
    }
  };

  /**
   * Validation for checking if user exists
   */
  validateUserExists = [param("did").isString().notEmpty().withMessage("DID required")];

  /**
   * Check if a user exists in the database
   */
  checkUserExists = async (
    req: express.Request,
    res: express.Response
  ): Promise<express.Response> => {
    const did = req.params.did;

    try {
      const exists = await this.profileService.checkUserExists(did);
      return res.json({ exists, did });
    } catch (err) {
      this.logger.error({ err, did }, "Failed to check user existence");
      return res.status(500).json({ error: "Failed to check user existence" });
    }
  };

  /**
   * Get the logged-in user's Bluesky follows who are also on Navyfragen
   */
  getFriends = async (req: express.Request, res: express.Response): Promise<express.Response> => {
    const userDid = req.session?.did;
    if (!userDid) {
      return res.status(403).json({ error: "Not authenticated" });
    }

    const agent = await initializeAgentFromSession(req, this.ctx);
    if (!agent) {
      return res.status(401).json({ error: "Session expired" });
    }

    try {
      const result = await this.profileService.getFriendsOnApp(userDid, agent);
      return res.json(result);
    } catch (err) {
      this.logger.error({ err, did: userDid }, "Failed to fetch friends on app");
      return res.status(500).json({ error: "Failed to fetch friends" });
    }
  };

  /**
   * Check if the logged-in user follows the notification bot
   */
  checkBotFollow = async (
    req: express.Request,
    res: express.Response
  ): Promise<express.Response> => {
    const userDid = req.session?.did;
    if (!userDid) {
      return res.status(403).json({ error: "Not authenticated" });
    }

    const agent = await initializeAgentFromSession(req, this.ctx);
    if (!agent) {
      return res.status(401).json({ error: "Session expired" });
    }

    try {
      const following = await this.profileService.checkFollowsBot(agent, BOT_DID);
      return res.json({ following });
    } catch (err) {
      this.logger.error({ err, did: userDid }, "Failed to check bot follow status");
      return res.status(500).json({ error: "Failed to check bot follow status" });
    }
  };

  /**
   * Validation for handle resolution
   */
  validateResolveHandle = [param("handle").isString().notEmpty().withMessage("Handle required")];

  /**
   * Resolve a handle to a DID
   */
  resolveHandle = async (
    req: express.Request,
    res: express.Response
  ): Promise<express.Response> => {
    const handle = req.params.handle;

    try {
      const did = await this.profileService.resolveHandleToDid(handle);
      return res.json({ did });
    } catch (err: any) {
      if (err.message === "Handle not found") {
        return res.status(404).json({ error: "Handle not found" });
      }
      this.logger.error({ err, handle }, "Failed to resolve handle");
      return res.status(500).json({ error: "Failed to resolve handle" });
    }
  };
  /* v8 ignore next 1 */
}
