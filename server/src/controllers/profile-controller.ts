import express from "express";
import { param } from "express-validator";
import { ProfileService } from "../services/profile-service";
import { Logger } from "pino";

export class ProfileController {
  constructor(
    private profileService: ProfileService,
    private logger: Logger
  ) {}

  /**
   * Validation for public profile request
   */
  validateGetPublicProfile = [
    param("did").isString().notEmpty().withMessage("DID required"),
  ];

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
      return res.status(500).json({ error: "Failed to fetch profile" });
    }
  };

  /**
   * Validation for checking if user exists
   */
  validateUserExists = [
    param("did").isString().notEmpty().withMessage("DID required"),
  ];

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
      return res.status(500).json({ error: "Failed to check user existence" });
    }
  };

  /**
   * Validation for handle resolution
   */
  validateResolveHandle = [
    param("handle").isString().notEmpty().withMessage("Handle required"),
  ];

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
      return res.status(500).json({ error: "Failed to resolve handle" });
    }
  };
}
